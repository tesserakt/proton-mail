import React, { useState, useEffect, memo } from 'react';
import { c } from 'ttag';
import { Location, History } from 'history';
import {
    Searchbox,
    useLabels,
    useFolders,
    PrivateHeader,
    FloatingButton,
    MainLogo,
    SettingsButton,
    SupportDropdown,
} from 'react-components';
import { MAILBOX_LABEL_IDS, APPS } from 'proton-shared/lib/constants';

import AdvancedSearchDropdown from './AdvancedSearchDropdown';
import { extractSearchParameters, setParamsInUrl } from '../../helpers/mailboxUrl';
import { Breakpoints } from '../../models/utils';
import { getLabelName } from '../../helpers/labels';
import { OnCompose } from '../../hooks/composer/useCompose';
import { MESSAGE_ACTIONS } from '../../constants';

interface Props {
    labelID: string;
    elementID: string | undefined;
    location: Location;
    history: History;
    breakpoints: Breakpoints;
    onSearch: (keyword?: string, labelID?: string) => void;
    onCompose: OnCompose;
    expanded?: boolean;
    onToggleExpand: () => void;
    onOpenShortcutsModal: () => void;
}

const MailHeader = ({
    labelID,
    elementID,
    location,
    history,
    breakpoints,
    expanded,
    onToggleExpand,
    onSearch,
    onCompose,
    onOpenShortcutsModal,
}: Props) => {
    const { keyword = '' } = extractSearchParameters(location);
    const [value, updateValue] = useState(keyword);
    const [oldLabelID, setOldLabelID] = useState<string>(MAILBOX_LABEL_IDS.INBOX);
    const [labels = []] = useLabels();
    const [folders = []] = useFolders();

    // Update the search input field when the keyword in the url is changed
    useEffect(() => updateValue(keyword), [keyword]);

    const searchDropdown = <AdvancedSearchDropdown labelID={labelID} keyword={value} isNarrow={breakpoints.isNarrow} />;

    const searchBox = (
        <Searchbox
            delay={0}
            placeholder={c('Placeholder').t`Search messages`}
            onSearch={(keyword) => {
                if (keyword) {
                    setOldLabelID(labelID);
                }
                onSearch(keyword, keyword ? undefined : oldLabelID);
            }}
            onChange={updateValue}
            value={value}
            advanced={searchDropdown}
        />
    );

    const backUrl = setParamsInUrl(history.location, { labelID });
    const showBackButton = breakpoints.isNarrow && elementID;
    const labelName = getLabelName(labelID, labels, folders);
    const logo = <MainLogo to="/inbox" />;

    return (
        <PrivateHeader
            logo={logo}
            backUrl={showBackButton && backUrl ? backUrl : undefined}
            title={labelName}
            settingsButton={<SettingsButton to="/settings/overview" toApp={APPS.PROTONMAIL} target="_self" />}
            searchBox={searchBox}
            searchDropdown={searchDropdown}
            expanded={!!expanded}
            onToggleExpand={onToggleExpand}
            isNarrow={breakpoints.isNarrow}
            supportDropdown={<SupportDropdown onOpenShortcutsModal={onOpenShortcutsModal} />}
            floatingButton={
                <FloatingButton onClick={() => onCompose({ action: MESSAGE_ACTIONS.NEW })} icon="compose" />
            }
        />
    );
};

export default memo(MailHeader);
