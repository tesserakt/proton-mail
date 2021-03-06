import { MESSAGE_FLAGS } from 'proton-shared/lib/mail/constants';
import { getAttachments, getRecipients, hasFlag } from 'proton-shared/lib/mail/messages';
import React, { MutableRefObject } from 'react';
import { c } from 'ttag';
import { isToday, isYesterday } from 'date-fns';
import {
    Button,
    useModals,
    ConfirmModal,
    Alert,
    classnames,
    Tooltip,
    Icon,
    EllipsisLoader,
    ErrorButton,
    useMailSettings,
} from 'react-components';
import { noop } from 'proton-shared/lib/helpers/function';
import { metaKey, shiftKey, altKey } from 'proton-shared/lib/helpers/browser';

import { formatSimpleDate } from '../../helpers/date';
import { MessageExtended } from '../../models/message';
import AttachmentsButton from '../attachment/AttachmentsButton';

interface Props {
    className?: string;
    message: MessageExtended;
    date: Date;
    lock: boolean;
    opening: boolean;
    sending: boolean;
    syncInProgress: boolean;
    onAddAttachments: (files: File[]) => void;
    onPassword: () => void;
    onExpiration: () => void;
    onSend: () => Promise<void>;
    onDelete: () => Promise<void>;
    addressesBlurRef: MutableRefObject<() => void>;
    attachmentTriggerRef: MutableRefObject<() => void>;
}

const ComposerActions = ({
    className,
    message,
    date,
    lock,
    opening,
    sending,
    syncInProgress,
    onAddAttachments,
    onPassword,
    onExpiration,
    onSend,
    onDelete,
    addressesBlurRef,
    attachmentTriggerRef,
}: Props) => {
    const { createModal } = useModals();

    const handleDelete = () => {
        return createModal(
            <ConfirmModal
                onConfirm={onDelete}
                onClose={noop}
                title={c('Title').t`Delete draft`}
                confirm={<ErrorButton type="submit">{c('Action').t`Delete`}</ErrorButton>}
            >
                <Alert type="error">{c('Info').t`Are you sure you want to permanently delete this draft?`}</Alert>
            </ConfirmModal>
        );
    };

    const isAttachments = getAttachments(message.data).length > 0;
    const isPassword = hasFlag(MESSAGE_FLAGS.FLAG_INTERNAL)(message.data) && message.data?.Password;
    const isExpiration = !!message.expiresIn;
    const hasRecipients = getRecipients(message.data).length > 0;
    const sendDisabled = !hasRecipients || lock;
    const [{ Hotkeys } = { Hotkeys: 0 }] = useMailSettings();

    let dateMessage: string | string[] = '';
    if (opening) {
        const ellipsis = <EllipsisLoader key="ellipsis1" />;
        dateMessage = c('Action').jt`Loading${ellipsis}`;
    } else if (syncInProgress) {
        const ellipsis = <EllipsisLoader key="ellipsis2" />;
        dateMessage = c('Action').jt`Saving${ellipsis}`;
    } else if (date.getTime() !== 0) {
        const dateString = formatSimpleDate(date);
        if (isToday(date)) {
            dateMessage = c('Info').t`Saved at ${dateString}`;
        } else if (isYesterday(date)) {
            dateMessage = c('Info').t`Saved ${dateString}`;
        } else {
            dateMessage = c('Info').t`Saved on ${dateString}`;
        }
    } else {
        dateMessage = c('Action').t`Not saved`;
    }

    let buttonSendLabel = c('Action').t`Send`;
    if (sending) {
        buttonSendLabel = c('Action').t`Sending`;
    }

    const titleAttachment = Hotkeys ? (
        <>
            {c('Title').t`Attachments`}
            <br />
            <kbd className="bg-global-altgrey noborder">{metaKey}</kbd> +{' '}
            <kbd className="bg-global-altgrey noborder">{shiftKey}</kbd> +{' '}
            <kbd className="bg-global-altgrey noborder">A</kbd>
        </>
    ) : (
        c('Title').t`Attachments`
    );
    const titleExpiration = Hotkeys ? (
        <>
            {c('Title').t`Expiration time`}
            <br />
            <kbd className="bg-global-altgrey noborder">{metaKey}</kbd> +{' '}
            <kbd className="bg-global-altgrey noborder">{shiftKey}</kbd> +{' '}
            <kbd className="bg-global-altgrey noborder">X</kbd>
        </>
    ) : (
        c('Title').t`Expiration time`
    );
    const titleEncryption = Hotkeys ? (
        <>
            {c('Title').t`Encryption`}
            <br />
            <kbd className="bg-global-altgrey noborder">{metaKey}</kbd> +{' '}
            <kbd className="bg-global-altgrey noborder">{shiftKey}</kbd> +{' '}
            <kbd className="bg-global-altgrey noborder">E</kbd>
        </>
    ) : (
        c('Title').t`Encryption`
    );
    const titleDeleteDraft = Hotkeys ? (
        <>
            {c('Title').t`Delete draft`}
            <br />
            <kbd className="bg-global-altgrey noborder">{metaKey}</kbd> +{' '}
            <kbd className="bg-global-altgrey noborder">{altKey}</kbd> +{' '}
            <kbd className="bg-global-altgrey noborder">Backspace</kbd>
        </>
    ) : (
        c('Title').t`Delete draft`
    );
    const titleSendButton = Hotkeys ? (
        <>
            {c('Title').t`Send email`}
            <br />
            <kbd className="bg-global-altgrey noborder">{metaKey}</kbd> +{' '}
            <kbd className="bg-global-altgrey noborder">Enter</kbd>
        </>
    ) : null;

    const sendButton = Hotkeys ? (
        <Tooltip title={titleSendButton}>
            <Button
                className="pm-button--primary composer-send-button"
                disabled={sendDisabled}
                loading={sending}
                onClick={onSend}
                data-testid="send-button"
            >
                <Icon name="sent" className="nodesktop notablet onmobile-flex" />
                <span className="pl1 pr1 nomobile">{buttonSendLabel}</span>
            </Button>
        </Tooltip>
    ) : (
        <Button
            className="pm-button--primary composer-send-button"
            disabled={sendDisabled}
            loading={sending}
            onClick={onSend}
            data-testid="send-button"
        >
            <Icon name="sent" className="nodesktop notablet onmobile-flex" />
            <span className="pl1 pr1 nomobile">{buttonSendLabel}</span>
        </Button>
    );

    return (
        <footer
            className={classnames([
                'composer-actions flex-item-noshrink flex flex-reverse flex-self-vcenter w100 pl1 pr1 mb0-5',
                className,
            ])}
            onClick={addressesBlurRef.current}
        >
            {sendButton}
            <div className="flex flex-item-fluid">
                <div className="flex">
                    <Tooltip title={titleAttachment} className="flex">
                        <AttachmentsButton
                            className={classnames([isAttachments && 'pm-button--primaryborder'])}
                            disabled={lock}
                            onAddAttachments={onAddAttachments}
                            attachmentTriggerRef={attachmentTriggerRef}
                        />
                    </Tooltip>
                    <Tooltip title={titleExpiration} className="flex ml0-5">
                        <Button
                            icon="expiration"
                            className={classnames([
                                'inline-flex flex-items-center pm-button--for-icon',
                                isExpiration && 'pm-button--primaryborder',
                            ])}
                            onClick={onExpiration}
                            disabled={lock}
                        >
                            <span className="sr-only">{c('Action').t`Expiration time`}</span>
                        </Button>
                    </Tooltip>
                    <Tooltip title={titleEncryption} className="flex ml0-5">
                        <Button
                            icon="lock-alone"
                            className={classnames([
                                'inline-flex flex-items-center pm-button--for-icon',
                                isPassword && 'pm-button--primaryborder',
                            ])}
                            onClick={onPassword}
                            disabled={lock}
                        >
                            <span className="sr-only">{c('Action').t`Encryption`}</span>
                        </Button>
                    </Tooltip>
                </div>
                <div className="flex mlauto">
                    <span className="mr0-5 mtauto mbauto nomobile">{dateMessage}</span>
                    <Tooltip title={titleDeleteDraft} className="flex mr0-5">
                        <Button
                            className="inline-flex flex-items-center pm-button--for-icon"
                            icon="trash"
                            disabled={lock}
                            onClick={handleDelete}
                        >
                            <span className="sr-only">{c('Action').t`Delete draft`}</span>
                        </Button>
                    </Tooltip>
                </div>
            </div>
        </footer>
    );
};

export default ComposerActions;
