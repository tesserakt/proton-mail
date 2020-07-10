import React, { Fragment, MouseEvent } from 'react';
import { c } from 'ttag';
import { Label, LinkButton, classnames } from 'react-components';
import { Recipient } from 'proton-shared/lib/interfaces/Address';
import { ContactEmail, ContactGroup } from 'proton-shared/lib/interfaces/contacts';

import { STATUS_ICONS_FILLS } from '../../../models/crypto';
import { MessageExtended } from '../../../models/message';
import { recipientTypes } from '../../../models/address';
import { getRecipients } from '../../../helpers/message/messages';
import { recipientsToRecipientOrGroup, getRecipientOrGroupLabel } from '../../../helpers/addresses';
import EncryptionStatusIcon from '../../message/EncryptionStatusIcon';
import { MessageSendInfo } from '../../../hooks/useSendInfo';

interface Props {
    message: MessageExtended;
    messageSendInfo?: MessageSendInfo;
    contacts: ContactEmail[];
    contactGroups: ContactGroup[];
    onFocus: () => void;
    toggleExpanded: (e: MouseEvent<HTMLButtonElement>) => void;
}

const AddressesSummary = ({
    message: { data },
    messageSendInfo,
    contacts,
    contactGroups,
    toggleExpanded,
    onFocus
}: Props) => {
    return (
        <div className="flex flex-row flex-nowrap flex-items-center m0-5 pl0-5 pr0-5" onClick={onFocus}>
            <Label className="composer-meta-label pr0-5 pt0 bold">{c('Title').t`To`}</Label>
            <div className="pm-field flex composer-addresses-fakefield flex-row flex-item-fluid w100 relative">
                <span className="ellipsis composer-addresses-fakefield-inner">
                    {getRecipients(data).length === 0 ? (
                        <span className="placeholder">{c('Placeholder').t`Email address`}</span>
                    ) : null}
                    {recipientTypes.map((type) => {
                        const recipients: Recipient[] = data?.[type] || [];
                        if (recipients.length === 0) {
                            return null;
                        }
                        const recipientOrGroups = recipientsToRecipientOrGroup(recipients, contactGroups);
                        return (
                            <Fragment key={type}>
                                {type === 'CCList' && (
                                    <span className="mr0-5 color-primary" title={c('Title').t`Carbon Copy`}>
                                        {c('Title').t`CC`}:
                                    </span>
                                )}
                                {type === 'BCCList' && (
                                    <span
                                        className="mr0-5 inline-flex color-primary"
                                        title={c('Title').t`Blind Carbon Copy`}
                                    >
                                        {c('Title').t`BCC`}:
                                    </span>
                                )}
                                {recipientOrGroups.map((recipientOrGroup, i) => {
                                    const Address = recipientOrGroup.recipient?.Address;
                                    const sendInfo = Address ? messageSendInfo?.mapSendInfo[Address] : undefined;
                                    const valid = sendInfo
                                        ? (sendInfo?.emailValidation && !sendInfo?.emailAddressWarnings?.length) ||
                                          false
                                        : true;
                                    const icon = sendInfo?.sendIcon;
                                    const cannotSend = !valid || icon?.fill === STATUS_ICONS_FILLS.FAIL;
                                    return (
                                        <span
                                            key={i}
                                            className={classnames([
                                                'inline-flex mr0-5 aligntop',
                                                cannotSend && 'color-global-warning'
                                            ])}
                                        >
                                            <span className="inline-flex flex-nowrap">
                                                {icon && <EncryptionStatusIcon {...icon} />}
                                                <span className="inline-flex mw100 ellipsis">
                                                    {getRecipientOrGroupLabel(recipientOrGroup, contacts)}
                                                </span>
                                            </span>
                                            {i !== recipientOrGroups.length - 1 && ','}
                                        </span>
                                    );
                                })}
                            </Fragment>
                        );
                    })}
                </span>
                <LinkButton
                    className="composer-addresses-ccbcc nodecoration strong"
                    title={c('Action').t`Carbon Copy, Blind Carbon Copy`}
                    onClick={toggleExpanded}
                >
                    {c('Action').t`CC, BCC`}
                </LinkButton>
            </div>
        </div>
    );
};

export default AddressesSummary;
