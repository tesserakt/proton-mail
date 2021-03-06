import React from 'react';
import { useUser, useModals, InlineLinkButton, AuthenticatedBugModal, AppLink } from 'react-components';
import { c, msgid } from 'ttag';
import { Location } from 'history';
import { MailSettings } from 'proton-shared/lib/interfaces';
import { getAccountSettingsApp } from 'proton-shared/lib/apps/helper';
import { MAILBOX_LABEL_IDS } from 'proton-shared/lib/constants';
import { capitalize } from 'proton-shared/lib/helpers/string';
import { getLightOrDark } from 'proton-shared/lib/themes/helpers';
import { LabelCount } from 'proton-shared/lib/interfaces/Label';
import unreadEmailsSvgLight from 'design-system/assets/img/shared/unread-emails.svg';
import unreadEmailsSvgDark from 'design-system/assets/img/shared/unread-emails-dark.svg';
import storageSvg from 'design-system/assets/img/shared/welcome/storage.svg';
import customSvg from 'design-system/assets/img/shared/welcome/custom.svg';

import { isConversationMode } from '../../helpers/mailSettings';

interface Props {
    mailSettings: MailSettings;
    location: Location;
    labelCount: LabelCount;
}

const WelcomePane = ({ mailSettings, location, labelCount }: Props) => {
    const conversationMode = isConversationMode(MAILBOX_LABEL_IDS.INBOX, mailSettings, location);

    const [user] = useUser();
    const { createModal } = useModals();

    const Unread = labelCount.Unread || 0;
    const unreadEmailsSvg = getLightOrDark(unreadEmailsSvgLight, unreadEmailsSvgDark);
    const userName = (
        <span key="display-name" className="inbl mw100 ellipsis alignbottom">
            {capitalize(user.DisplayName)}
        </span>
    );

    const unreadsLabel = conversationMode ? (
        <strong key="unreads-label">
            {c('Info').ngettext(msgid`${Unread} unread conversation`, `${Unread} unread conversations`, Unread)}
        </strong>
    ) : (
        <strong key="unreads-label">
            {c('Info').ngettext(msgid`${Unread} unread message`, `${Unread} unread messages`, Unread)}
        </strong>
    );

    const reportBugButton = (
        <InlineLinkButton key="report-bug-btn" onClick={() => createModal(<AuthenticatedBugModal />)}>{c('Action')
            .t`report a bug`}</InlineLinkButton>
    );

    const startingPrice = <strong key="starting-price">$4/month</strong>;

    return (
        <div className="mtauto mbauto aligncenter p2 mw100 scroll-if-needed">
            <h1>{user.DisplayName ? c('Title').jt`Welcome, ${userName}!` : c('Title').t`Welcome!`}</h1>
            {Unread ? <p>{c('Info').jt`You have ${unreadsLabel} in your inbox.`}</p> : null}
            {user.hasPaidMail ? (
                <>
                    <p className="mw40e center mb2">
                        {c('Info')
                            .jt`Having trouble sending or receiving emails? Interested in helping us improve our service? Feel free to ${reportBugButton}.`}
                    </p>
                    <img
                        className="hauto"
                        src={unreadEmailsSvg}
                        alt={c('Alternative text for welcome image').t`Welcome`}
                    />
                </>
            ) : (
                <>
                    <p>{c('Info')
                        .jt`Upgrade to a paid plan starting from ${startingPrice} only and get additional storage capacity and more addresses with ProtonMail Plus.`}</p>
                    <div className="boxes-placeholder-container flex flex-nowrap mw50e center mt2">
                        <div className="bordered-container flex-item-fluid flex flex-column aligncenter p1 mr2">
                            <img className="mb1 hauto" src={storageSvg} alt={c('Alt').t`Storage`} />
                            <p className="mt0 mb1 bold">{c('Info').t`5GB Storage`}</p>
                            <p className="mt0 mb1">{c('Info')
                                .t`Get enough storage space to hold on your history of precious communications.`}</p>
                            <AppLink
                                to="/subscription"
                                toApp={getAccountSettingsApp()}
                                className="pm-button--primary mtauto"
                            >{c('Action').t`Upgrade`}</AppLink>
                        </div>
                        <div className="bordered-container flex-item-fluid flex flex-column aligncenter p1 mr2">
                            <img className="mb1 hauto" src={customSvg} alt={c('Alt').t`Mail`} />
                            <p className="mt0 mb1 bold">{c('Info').t`5 Email Addresses`}</p>
                            <p className="mt0 mb1">{c('Info')
                                .t`Set up to 5 email addresses and use them as you deem fit.`}</p>
                            <AppLink
                                to="/subscription"
                                toApp={getAccountSettingsApp()}
                                className="pm-button--primary mtauto"
                            >{c('Action').t`Upgrade`}</AppLink>
                        </div>
                        <div className="bordered-container flex-item-fluid flex flex-column aligncenter p1">
                            <img className="mb1 hauto" src={customSvg} alt={c('Alt').t`Customization`} />
                            <p className="mt0 mb1 bold">{c('Info').t`Customization`}</p>
                            <p className="mt0 mb1">{c('Info')
                                .t`Folders, Labels, Auto-reply and more ways to tweak ProtonMail to match the way you work.`}</p>
                            <AppLink
                                to="/subscription"
                                toApp={getAccountSettingsApp()}
                                className="pm-button--primary mtauto"
                            >{c('Action').t`Upgrade`}</AppLink>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default WelcomePane;
