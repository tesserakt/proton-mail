import { DecryptResultPmcrypto } from 'pmcrypto';
import { MIME_TYPES, PGP_SIGN } from 'proton-shared/lib/constants';
import { MailSettings, Recipient } from 'proton-shared/lib/interfaces';
import React from 'react';
import { act, fireEvent } from '@testing-library/react';
import { Message } from 'proton-shared/lib/interfaces/mail/Message';
import { useEventManager } from 'react-components';
import squire from 'squire-rte';
import {
    clearAll,
    render,
    tick,
    messageCache,
    GeneratedKey,
    generateKeys,
    addKeysToAddressKeysCache,
    addApiMock,
    decryptMessageLegacy,
    readSessionKey,
    waitForSpyCall,
    minimalCache,
    addToCache,
    decryptSessionKey,
    addApiKeys,
    decryptMessageMultipart,
    createDocument,
    addKeysToUserKeysCache,
    createAttachment,
    attachmentsCache,
    apiKeys,
} from '../../helpers/test/helper';
import Composer from './Composer';
import { MessageExtended, MessageExtendedWithData, PartialMessageExtended } from '../../models/message';
import { Breakpoints } from '../../models/utils';
import { mergeMessages } from '../../helpers/message/messages';
import { addApiContact } from '../../helpers/test/contact';
import { arrayToBase64 } from '../../helpers/base64';
import { createEmbeddedMap } from '../../helpers/embedded/embeddeds';
import { getContent } from '../../helpers/message/messageContent';

const getHTML = squire().getHTML as jest.Mock;
const setHTML = squire().setHTML as jest.Mock;

jest.setTimeout(20000);

// Prevent the actual encrypt and upload attachment
jest.mock('../../helpers/attachment/attachmentUploader', () => {
    return {
        ATTACHMENT_ACTION: {
            ATTACHMENT: 'attachment',
            INLINE: 'inline',
        },
        upload: () => [
            {
                resultPromise: new Promise(() => {
                    // empty
                }),
                addProgressListener: () => {
                    // empty
                },
            },
        ],
        isSizeExceeded: () => false,
    };
});

const ID = 'ID';

const png = new File([], 'file.png', { type: 'image/png' });

const props = {
    index: 0,
    count: 1,
    focus: true,
    message: {},
    mailSettings: {} as MailSettings,
    windowSize: { width: 1000, height: 1000 },
    breakpoints: {} as Breakpoints,
    addresses: [],
    onFocus: jest.fn(),
    onChange: jest.fn(),
    onClose: jest.fn(),
    onCompose: jest.fn(),
};

describe('Composer', () => {
    afterEach(clearAll);

    it('should not show embedded modal when plaintext mode', async () => {
        const message = {
            localID: ID,
            initialized: true,
            data: {
                ID,
                MIMEType: 'text/plain' as MIME_TYPES,
                Subject: '',
                ToList: [] as Recipient[],
            },
        } as MessageExtended;
        messageCache.set(ID, message);
        const { getByTestId, queryByText } = await render(<Composer {...props} messageID={ID} />);
        const inputAttachment = getByTestId('composer-attachments-button') as HTMLInputElement;
        fireEvent.change(inputAttachment, { target: { files: [png] } });
        await tick();
        const embeddedModal = queryByText('0 image detected');
        expect(embeddedModal).toBe(null);
        // TODO: Restore that test
        // await findByText('1 file attached');
    });

    describe('sending', () => {
        const AddressID = 'AddressID';
        const fromAddress = 'me@home.net';
        const toAddress = 'someone@somewhere.net';

        let fromKeys: GeneratedKey;
        let secondFromKeys: GeneratedKey;
        let toKeys: GeneratedKey;

        const prepareMessage = (message: PartialMessageExtended) => {
            const baseMessage = {
                localID: 'localID',
                data: {
                    ID,
                    AddressID,
                    Subject: 'Subject',
                    Sender: { Name: '', Address: fromAddress },
                    ToList: [{ Name: '', Address: toAddress }],
                    CCList: [],
                    BCCList: [],
                } as Partial<Message>,
                initialized: true,
            } as MessageExtendedWithData;

            const resultMessage = mergeMessages(baseMessage, message);

            messageCache.set(resultMessage.localID, resultMessage);

            return resultMessage as MessageExtendedWithData;
        };

        const send = async (message: MessageExtended, useMinimalCache = true) => {
            if (!apiKeys.has(toAddress)) {
                addApiKeys(false, toAddress, []);
            }

            getHTML.mockImplementation(() => getContent(message));

            const renderResult = await render(<Composer {...props} messageID={message.localID} />, useMinimalCache);

            // Fake timers after render, it breaks rendering, I would love to know why
            jest.useFakeTimers();

            const sendSpy = jest.fn(() => Promise.resolve({ Sent: {} }));
            addApiMock(`mail/v4/messages/${ID}`, sendSpy);

            const sendButton = renderResult.getByTestId('send-button');
            fireEvent.click(sendButton);

            // Wait for the event manager to be called as it's the last step of the sendMessage hook
            // Hard override of the typing as event manager is mocked
            const { call } = ((useEventManager as any) as () => { call: jest.Mock })();

            await waitForSpyCall(call);

            await act(async () => {
                jest.runAllTimers();
            });

            const sendRequest = (sendSpy.mock.calls[0] as any[])[0];

            expect(sendRequest.method).toBe('post');

            return sendRequest;
        };

        beforeAll(async () => {
            fromKeys = await generateKeys('me', fromAddress);
            secondFromKeys = await generateKeys('secondme', fromAddress);
            toKeys = await generateKeys('someone', toAddress);
        });

        beforeEach(() => {
            addKeysToAddressKeysCache(AddressID, fromKeys);
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        describe('send plaintext', () => {
            it('text/plain clear', async () => {
                const message = prepareMessage({
                    localID: ID,
                    plainText: 'test',
                    data: { MIMEType: MIME_TYPES.PLAINTEXT },
                });

                addKeysToAddressKeysCache(message.data.AddressID, fromKeys);

                const sendRequest = await send(message);

                expect(sendRequest.data.ExpirationTime).toBeUndefined();
                expect(sendRequest.data.ExpiresIn).toBeUndefined();

                const packages = sendRequest.data.Packages;
                const pack = packages['text/plain'];

                expect(pack).toBeDefined();

                const sessionKey = readSessionKey(pack.BodyKey);

                const decryptResult = await decryptMessageLegacy(pack, fromKeys.privateKeys, sessionKey);

                expect(decryptResult.data).toBe(message.plainText);
            });

            it('text/plain self', async () => {
                const message = prepareMessage({
                    plainText: 'test',
                    data: { MIMEType: MIME_TYPES.PLAINTEXT, ToList: [{ Name: '', Address: fromAddress }] },
                });

                minimalCache();
                addToCache('Addresses', [
                    {
                        ID: message.data.AddressID,
                        Email: fromAddress,
                        Receive: 1,
                        HasKeys: true,
                    },
                ]);

                const sendRequest = await send(message, false);

                expect(sendRequest.data.ExpirationTime).toBeUndefined();
                expect(sendRequest.data.ExpiresIn).toBeUndefined();

                const packages = sendRequest.data.Packages;
                const pack = packages['text/plain'];
                const address = pack.Addresses[fromAddress];

                const sessionKey = await decryptSessionKey(address.BodyKeyPacket, fromKeys.privateKeys);

                expect(sessionKey).toBeDefined();

                const decryptResult = await decryptMessageLegacy(pack, fromKeys.privateKeys, sessionKey);

                expect(decryptResult.data).toBe(message.plainText);
            });

            it('text/plain pgp internal', async () => {
                const message = prepareMessage({ plainText: 'test', data: { MIMEType: MIME_TYPES.PLAINTEXT } });

                addApiKeys(true, toAddress, [toKeys]);

                const sendRequest = await send(message);

                expect(sendRequest.data.ExpirationTime).toBeUndefined();
                expect(sendRequest.data.ExpiresIn).toBeUndefined();

                const packages = sendRequest.data.Packages;
                const pack = packages['text/plain'];
                const address = pack.Addresses[toAddress];

                const sessionKey = await decryptSessionKey(address.BodyKeyPacket, toKeys.privateKeys);

                expect(sessionKey).toBeDefined();

                const decryptResult = await decryptMessageLegacy(pack, toKeys.privateKeys, sessionKey);

                expect(decryptResult.data).toBe(message.plainText);
            });

            it('multipart/mixed pgp external', async () => {
                const message = prepareMessage({ plainText: 'test', data: { MIMEType: MIME_TYPES.PLAINTEXT } });

                addApiKeys(false, toAddress, [toKeys]);

                const sendRequest = await send(message);

                expect(sendRequest.data.ExpirationTime).toBeUndefined();
                expect(sendRequest.data.ExpiresIn).toBeUndefined();

                const packages = sendRequest.data.Packages;
                const pack = packages['multipart/mixed'];
                const address = pack.Addresses[toAddress];

                const sessionKey = await decryptSessionKey(address.BodyKeyPacket, toKeys.privateKeys);

                expect(sessionKey).toBeDefined();

                const decryptResult = await decryptMessageMultipart(pack, toKeys.privateKeys, sessionKey);

                expect(decryptResult.data).toBe(message.plainText);
                expect(decryptResult.mimeType).toBe(message.data.MIMEType);
            });

            it('downgrade to plaintext due to contact setting', async () => {
                const content = 'test';

                const message = prepareMessage({
                    document: createDocument(content),
                    data: { MIMEType: MIME_TYPES.DEFAULT },
                });

                minimalCache();
                addToCache('MailSettings', { DraftMIMEType: MIME_TYPES.DEFAULT } as MailSettings);
                addKeysToUserKeysCache(fromKeys);
                addApiContact({ contactID: 'ContactID', email: toAddress, mimeType: MIME_TYPES.PLAINTEXT }, fromKeys);

                const sendRequest = await send(message, false);

                expect(sendRequest.data.ExpirationTime).toBeUndefined();
                expect(sendRequest.data.ExpiresIn).toBeUndefined();

                const packages = sendRequest.data.Packages;
                const pack = packages['text/plain'];

                expect(pack).toBeDefined();

                const sessionKey = readSessionKey(pack.BodyKey);

                const decryptResult = await decryptMessageLegacy(pack, fromKeys.privateKeys, sessionKey);

                expect(decryptResult.data).toBe(content);
            });

            it.skip('downgrade to plaintext and sign', async () => {
                const content = 'test';

                const message = prepareMessage({
                    document: createDocument(content),
                    data: { MIMEType: MIME_TYPES.DEFAULT },
                });

                minimalCache();
                addToCache('MailSettings', { DraftMIMEType: MIME_TYPES.DEFAULT, Sign: PGP_SIGN } as MailSettings);
                addApiContact({ contactID: 'ContactID', email: toAddress, mimeType: MIME_TYPES.PLAINTEXT }, fromKeys);

                const sendRequest = await send(message, false);

                expect(sendRequest.data.ExpirationTime).toBeUndefined();
                expect(sendRequest.data.ExpiresIn).toBeUndefined();

                const packages = sendRequest.data.Packages;
                const pack = packages['text/plain'];

                expect(pack).toBeDefined();

                const sessionKey = readSessionKey(pack.BodyKey);

                const decryptResult = await decryptMessageLegacy(pack, fromKeys.privateKeys, sessionKey);

                expect(decryptResult.data).toBe(content);
            });
        });

        describe('send html', () => {
            it('text/html clear', async () => {
                const content = 'test';

                const message = prepareMessage({
                    document: createDocument(content),
                    data: { MIMEType: MIME_TYPES.DEFAULT },
                });

                minimalCache();
                addToCache('MailSettings', { DraftMIMEType: MIME_TYPES.DEFAULT } as MailSettings);

                const sendRequest = await send(message, false);

                expect(sendRequest.data.ExpirationTime).toBeUndefined();
                expect(sendRequest.data.ExpiresIn).toBeUndefined();

                const packages = sendRequest.data.Packages;
                const pack = packages['text/html'];

                expect(pack).toBeDefined();

                const sessionKey = readSessionKey(pack.BodyKey);

                const decryptResult = await decryptMessageLegacy(pack, fromKeys.privateKeys, sessionKey);

                expect(decryptResult.data).toBe(content);
            });

            it('text/html pgp internal', async () => {
                const content = 'test';

                const message = prepareMessage({
                    document: createDocument(content),
                    data: { MIMEType: MIME_TYPES.DEFAULT },
                });

                minimalCache();
                addToCache('MailSettings', { DraftMIMEType: MIME_TYPES.DEFAULT } as MailSettings);
                addApiKeys(true, toAddress, [toKeys]);

                const sendRequest = await send(message, false);

                expect(sendRequest.data.ExpirationTime).toBeUndefined();
                expect(sendRequest.data.ExpiresIn).toBeUndefined();

                const packages = sendRequest.data.Packages;
                const pack = packages['text/html'];
                const address = pack.Addresses[toAddress];

                const sessionKey = await decryptSessionKey(address.BodyKeyPacket, toKeys.privateKeys);

                expect(sessionKey).toBeDefined();

                const decryptResult = await decryptMessageLegacy(pack, toKeys.privateKeys, sessionKey);

                expect(decryptResult.data).toBe(content);
            });

            it('no downgrade even for default plaintext', async () => {
                const content = 'test';

                const message = prepareMessage({
                    document: createDocument(content),
                    data: { MIMEType: MIME_TYPES.DEFAULT },
                });

                minimalCache();
                addToCache('MailSettings', { DraftMIMEType: MIME_TYPES.PLAINTEXT } as MailSettings);
                addApiKeys(true, toAddress, [toKeys]);

                const sendRequest = await send(message, false);

                expect(sendRequest.data.ExpirationTime).toBeUndefined();
                expect(sendRequest.data.ExpiresIn).toBeUndefined();

                const packages = sendRequest.data.Packages;
                const pack = packages['text/html'];
                const address = pack.Addresses[toAddress];

                const sessionKey = await decryptSessionKey(address.BodyKeyPacket, toKeys.privateKeys);

                expect(sessionKey).toBeDefined();

                const decryptResult = await decryptMessageLegacy(pack, toKeys.privateKeys, sessionKey);

                expect(decryptResult.data).toBe(content);
            });

            it('multipart/mixed pgp external', async () => {
                const content = 'test';
                const document = window.document.createElement('div');
                document.innerHTML = content;

                const message = prepareMessage({ document, data: { MIMEType: MIME_TYPES.DEFAULT } });

                minimalCache();
                addToCache('MailSettings', { DraftMIMEType: MIME_TYPES.DEFAULT } as MailSettings);
                addApiKeys(false, toAddress, [toKeys]);

                const sendRequest = await send(message, false);

                expect(sendRequest.data.ExpirationTime).toBeUndefined();
                expect(sendRequest.data.ExpiresIn).toBeUndefined();

                const packages = sendRequest.data.Packages;
                const pack = packages['multipart/mixed'];
                const address = pack.Addresses[toAddress];

                const sessionKey = await decryptSessionKey(address.BodyKeyPacket, toKeys.privateKeys);

                expect(sessionKey).toBeDefined();

                const decryptResult = await decryptMessageMultipart(pack, toKeys.privateKeys, sessionKey);

                expect(decryptResult.data).toBe(content);
                expect(decryptResult.mimeType).toBe(message.data.MIMEType);
            });
        });

        describe('attachments', () => {
            it('text/html with attachment', async () => {
                const content = 'test';
                const { attachment, sessionKey: generatedSessionKey } = await createAttachment(
                    {
                        ID: 'AttachmentID',
                        Name: 'image.png',
                        MIMEType: 'image/png',
                    },
                    fromKeys.publicKeys
                );
                const message = prepareMessage({
                    document: createDocument(content),
                    data: { MIMEType: MIME_TYPES.DEFAULT, Attachments: [attachment] },
                });

                minimalCache();
                addToCache('MailSettings', { DraftMIMEType: MIME_TYPES.DEFAULT } as MailSettings);
                addApiKeys(true, toAddress, [toKeys]);

                const sendRequest = await send(message, false);

                expect(sendRequest.data.ExpirationTime).toBeUndefined();
                expect(sendRequest.data.ExpiresIn).toBeUndefined();

                const packages = sendRequest.data.Packages;
                const pack = packages['text/html'];
                const address = pack.Addresses[toAddress];
                const AttachmentKeyPackets = address.AttachmentKeyPackets[attachment.ID as string];

                const sessionKey = await decryptSessionKey(AttachmentKeyPackets, toKeys.privateKeys);

                expect(arrayToBase64(sessionKey.data)).toBe(arrayToBase64(generatedSessionKey.data));
            });

            it('multipart/mixed with attachment', async () => {
                const content = 'test';
                const { attachment } = await createAttachment(
                    {
                        ID: 'AttachmentID',
                        Name: 'image.png',
                        MIMEType: 'image/png',
                    },
                    fromKeys.publicKeys
                );
                const message = prepareMessage({
                    document: createDocument(content),
                    data: { MIMEType: MIME_TYPES.DEFAULT, Attachments: [attachment] },
                });

                addApiKeys(false, toAddress, [toKeys]);
                attachmentsCache.set(attachment.ID as string, {} as DecryptResultPmcrypto);

                const sendRequest = await send(message);

                expect(sendRequest.data.ExpirationTime).toBeUndefined();
                expect(sendRequest.data.ExpiresIn).toBeUndefined();

                const packages = sendRequest.data.Packages;
                const pack = packages['multipart/mixed'];
                const address = pack.Addresses[toAddress];

                const sessionKey = await decryptSessionKey(address.BodyKeyPacket, toKeys.privateKeys);

                expect(sessionKey).toBeDefined();

                const decryptResult = await decryptMessageMultipart(pack, toKeys.privateKeys, sessionKey);

                expect(decryptResult.data).toBe(content);
                expect(decryptResult.mimeType).toBe(message.data.MIMEType);
                expect(decryptResult.attachments.length).toBe(1);
                expect(decryptResult.attachments[0].fileName).toBe(attachment.Name);
                expect(decryptResult.attachments[0].contentType).toBe(attachment.MIMEType);
            });

            it('embedded image', async () => {
                const cid = 'cid';
                const imageUrl = 'https://localhost/some-generated-id';
                const { attachment } = await createAttachment(
                    {
                        ID: 'AttachmentID',
                        Name: 'embedded.png',
                        MIMEType: 'image/png',
                        Headers: { 'content-id': cid },
                    },
                    fromKeys.publicKeys
                );

                const embeddeds = createEmbeddedMap();
                embeddeds.set(cid, { attachment, url: imageUrl });

                const content = `<img src="${imageUrl}" data-embedded-img="${cid}">`;
                const document = window.document.createElement('div');
                document.innerHTML = content;

                const message = prepareMessage({
                    document,
                    embeddeds,
                    data: { MIMEType: MIME_TYPES.DEFAULT, Attachments: [attachment] },
                });

                minimalCache();
                addToCache('MailSettings', { DraftMIMEType: MIME_TYPES.DEFAULT } as MailSettings);
                addApiKeys(true, toAddress, [toKeys]);

                const sendRequest = await send(message, false);

                expect(sendRequest.data.ExpirationTime).toBeUndefined();
                expect(sendRequest.data.ExpiresIn).toBeUndefined();

                const packages = sendRequest.data.Packages;
                const pack = packages['text/html'];
                const address = pack.Addresses[toAddress];

                const sessionKey = await decryptSessionKey(address.BodyKeyPacket, toKeys.privateKeys);

                expect(sessionKey).toBeDefined();

                const decryptResult = await decryptMessageLegacy(pack, toKeys.privateKeys, sessionKey);

                expect(decryptResult.data).toBe(`<img src="cid:${cid}">`);
            });
        });

        it('should not encrypt message with multiple keys', async () => {
            const message = prepareMessage({ plainText: 'test', data: { MIMEType: MIME_TYPES.PLAINTEXT } });

            addKeysToAddressKeysCache(message.data.AddressID, secondFromKeys);
            addApiKeys(true, toAddress, [toKeys]);

            const sendRequest = await send(message);

            expect(sendRequest.data.ExpirationTime).toBeUndefined();
            expect(sendRequest.data.ExpiresIn).toBeUndefined();

            const packages = sendRequest.data.Packages;
            const pack = packages['text/plain'];
            const address = pack.Addresses[toAddress];

            const sessionKey = await decryptSessionKey(address.BodyKeyPacket, toKeys.privateKeys);
            const decryptResult = await decryptMessageLegacy(pack, toKeys.privateKeys, sessionKey);

            // Having 2 signatures here would meen we used both private keys to encrypt
            // It's not "wrong", it works with OpenPGP and API accept it
            // But other clients (Android, iOS, Bridge) don't support it so it's critical to use only one key
            expect(decryptResult.signatures.length).toBe(1);
        });
    });

    describe('switch plaintext <-> html', () => {
        it('should switch from plaintext to html content without loosing content', async () => {
            const content = 'content';

            const message = {
                localID: ID,
                initialized: true,
                data: {
                    ID,
                    MIMEType: 'text/plain' as MIME_TYPES,
                    Subject: '',
                    ToList: [] as Recipient[],
                },
                plainText: content,
            } as MessageExtended;
            messageCache.set(ID, message);

            const { findByTestId } = await render(<Composer {...props} messageID={ID} />);

            const moreDropdown = await findByTestId('squire-more');
            fireEvent.click(moreDropdown);

            const toHtmlButton = await findByTestId('squire-to-html');
            fireEvent.click(toHtmlButton);

            await waitForSpyCall(setHTML);

            await findByTestId('squire-iframe');

            expect(setHTML).toHaveBeenCalledWith(`<p>${content}</p>\n`);
        });

        it('should switch from html to plaintext content without loosing content', async () => {
            const content = `
              <div>content line 1<br><div>
              <div>content line 2<br><div>
            `;

            const message = {
                localID: ID,
                initialized: true,
                data: {
                    ID,
                    MIMEType: 'text/html' as MIME_TYPES,
                    Subject: '',
                    ToList: [] as Recipient[],
                },
                document: createDocument(content),
            } as MessageExtended;
            messageCache.set(ID, message);

            const { findByTestId } = await render(<Composer {...props} messageID={ID} />);

            const moreDropdown = await findByTestId('squire-more');
            fireEvent.click(moreDropdown);

            const toHtmlButton = await findByTestId('squire-to-plaintext');
            fireEvent.click(toHtmlButton);

            const textarea = (await findByTestId('squire-textarea')) as HTMLTextAreaElement;

            expect(textarea.value).toBe('content line 1\n\ncontent line 2');
        });
    });
});
