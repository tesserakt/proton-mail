import React from 'react';
import {
    Icon,
    useLoading,
    useNotifications,
    useEventManager,
    useApi,
    ConfirmModal,
    ErrorButton,
    useModals,
    Alert
} from 'react-components';
import { MAILBOX_LABEL_IDS } from 'proton-shared/lib/constants';
import { deleteMessages } from 'proton-shared/lib/api/messages';
import { deleteConversations } from 'proton-shared/lib/api/conversations';
import { c, msgid } from 'ttag';

import ToolbarButton from './ToolbarButton';
import { Breakpoints } from '../../models/utils';
import { labelIncludes } from '../../helpers/labels';

const { TRASH, SPAM, DRAFTS, ALL_DRAFTS, SENT, ALL_SENT } = MAILBOX_LABEL_IDS;

interface Props {
    labelID: string;
    conversationMode: boolean;
    breakpoints: Breakpoints;
    selectedIDs: string[];
}

const DeleteButton = ({ labelID = '', conversationMode, breakpoints, selectedIDs = [] }: Props) => {
    const { createNotification } = useNotifications();
    const { createModal } = useModals();
    const { call } = useEventManager();
    const api = useApi();
    const [loading, withLoading] = useLoading();
    const count = selectedIDs.length;
    const draft = labelID === DRAFTS || labelID == ALL_DRAFTS;

    const displayDelete =
        labelIncludes(labelID, TRASH, SPAM, DRAFTS, ALL_DRAFTS, SENT, ALL_SENT) &&
        (!breakpoints.isNarrow || !labelIncludes(labelID, DRAFTS, ALL_DRAFTS, SENT, ALL_SENT));

    const handleDelete = async () => {
        const modalTitle = draft
            ? c('Title').ngettext(msgid`Delete draft`, `Delete ${count} drafts`, count)
            : conversationMode
            ? c('Title').ngettext(msgid`Delete conversation`, `Delete ${count} conversations`, count)
            : c('Title').ngettext(msgid`Delete message`, `Delete ${count} messages`, count);

        const modalText = draft
            ? c('Info').ngettext(
                  msgid`Are you sure you want to permanently delete this draft?`,
                  `Are you sure you want to permanently delete these ${count} drafts?`,
                  count
              )
            : conversationMode
            ? c('Info').ngettext(
                  msgid`Are you sure you want to permanently delete this conversation?`,
                  `Are you sure you want to permanently delete these ${count} conversations?`,
                  count
              )
            : c('Info').ngettext(
                  msgid`Are you sure you want to permanently delete this message?`,
                  `Are you sure you want to permanently delete these ${count} messages?`,
                  count
              );

        await new Promise((resolve, reject) => {
            createModal(
                <ConfirmModal
                    title={modalTitle}
                    confirm={<ErrorButton type="submit">{c('Action').t`Delete`}</ErrorButton>}
                    onConfirm={resolve}
                    onClose={reject}
                >
                    <Alert type="error">{modalText}</Alert>
                </ConfirmModal>
            );
        });

        const action = conversationMode ? deleteConversations(selectedIDs, labelID) : deleteMessages(selectedIDs);
        await api(action);
        await call();

        const notificationText = draft
            ? c('Success').ngettext(msgid`Draft deleted`, `${count} drafts deleted`, count)
            : conversationMode
            ? c('Success').ngettext(msgid`Conversation deleted`, `${count} conversations deleted`, count)
            : c('Success').ngettext(msgid`Message deleted`, `${count} messages deleted`, count);

        createNotification({ text: notificationText });
    };

    if (!displayDelete) {
        return null;
    }

    return (
        <ToolbarButton
            loading={loading}
            title={c('Action').t`Delete permanently`}
            onClick={() => withLoading(handleDelete())}
            disabled={!selectedIDs.length}
            data-test-id="toolbar:deletepermanently"
        >
            <Icon className="toolbar-icon mauto" name="delete" />
        </ToolbarButton>
    );
};

export default DeleteButton;
