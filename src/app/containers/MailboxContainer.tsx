import React, { useState, useMemo, useEffect, useCallback, useRef, memo } from 'react';
import { History, Location } from 'history';
import { PrivateMainArea } from 'react-components';
import { Message } from 'proton-shared/lib/interfaces/mail/Message';
import { isDraft } from 'proton-shared/lib/mail/messages';
import { VIEW_MODE } from 'proton-shared/lib/constants';
import { MailSettings, UserSettings } from 'proton-shared/lib/interfaces';
import { getSearchParams } from 'proton-shared/lib/helpers/url';
import { Sort, Filter, Page, SearchParameters } from '../models/tools';
import { useMailboxPageTitle } from '../hooks/mailbox/useMailboxPageTitle';
import { useElements } from '../hooks/mailbox/useElements';
import { isColumnMode, isConversationMode } from '../helpers/mailSettings';
import {
    pageFromUrl,
    sortFromUrl,
    filterFromUrl,
    setPageInUrl,
    setSortInUrl,
    setFilterInUrl,
    setParamsInLocation,
    extractSearchParameters,
} from '../helpers/mailboxUrl';
import Toolbar from '../components/toolbar/Toolbar';
import List from '../components/list/List';
import ConversationView from '../components/conversation/ConversationView';
import PlaceholderView from '../components/view/PlaceholderView';
import MessageOnlyView from '../components/message/MessageOnlyView';
import { PAGE_SIZE } from '../constants';
import { isMessage, isSearch as testIsSearch } from '../helpers/elements';
import { Breakpoints } from '../models/utils';
import { OnCompose } from '../hooks/composer/useCompose';
import { useWelcomeFlag } from '../hooks/mailbox/useWelcomeFlag';
import useNewEmailNotification from '../hooks/mailbox/useNewEmailNotification';
import { pageCount } from '../helpers/paging';
import { useDeepMemo } from '../hooks/useDeepMemo';
import { useGetElementsFromIDs } from '../hooks/mailbox/useElementsCache';
import { useMailboxHotkeys } from '../hooks/mailbox/useMailboxHotkeys';
import { useMailboxSelection } from '../hooks/mailbox/useMailboxSelection';
import { useMailboxFocus } from '../hooks/mailbox/useMailboxFocus';

import './MailboxContainer.scss';

interface Props {
    labelID: string;
    userSettings: UserSettings;
    mailSettings: MailSettings;
    breakpoints: Breakpoints;
    elementID?: string;
    messageID?: string;
    location: Location;
    history: History;
    onCompose: OnCompose;
}

const MailboxContainer = ({
    labelID: inputLabelID,
    userSettings,
    mailSettings,
    breakpoints,
    elementID,
    messageID,
    location,
    history,
    onCompose,
}: Props) => {
    const getElementsFromIDs = useGetElementsFromIDs();
    const listRef = useRef<HTMLDivElement>(null);
    const forceRowMode = breakpoints.isNarrow || breakpoints.isTablet;
    const columnModeSetting = isColumnMode(mailSettings);
    const columnMode = columnModeSetting && !forceRowMode;
    const columnLayout = columnModeSetting || forceRowMode;

    // Page state is hybrid: page number is handled by the url, total computed in useElements, size and limit are constants
    // Yet, it is simpler to co-localize all these data in one object
    const [page, setPage] = useState<Page>({
        page: pageFromUrl(location),
        total: 0,
        size: PAGE_SIZE,
        limit: PAGE_SIZE,
    });

    const searchParams = getSearchParams(location.search);
    const isConversationContentView = mailSettings.ViewMode === VIEW_MODE.GROUP;
    const searchParameters = useMemo<SearchParameters>(() => extractSearchParameters(location), [
        searchParams.address,
        searchParams.from,
        searchParams.to,
        searchParams.keyword,
        searchParams.begin,
        searchParams.end,
        searchParams.attachments,
        searchParams.wildcard,
    ]);
    const isSearch = testIsSearch(searchParameters);
    const sort = useMemo<Sort>(() => sortFromUrl(location), [searchParams.sort]);
    const filter = useMemo<Filter>(() => filterFromUrl(location), [searchParams.filter]);

    const { labelID, elements, loading, expectedLength, total } = useElements({
        conversationMode: isConversationMode(inputLabelID, mailSettings, location),
        labelID: inputLabelID,
        pageFromUrl: pageFromUrl(location),
        sort,
        filter,
        search: searchParameters,
    });

    useEffect(() => setPage({ ...page, page: pageFromUrl(location) }), [searchParams.page]);
    useEffect(() => setPage({ ...page, total }), [total]);

    useMailboxPageTitle(labelID, location);

    const elementIDs = useDeepMemo(() => {
        return elements.map((element) => element.ID || '');
    }, [elements]);

    const {
        checkedIDs,
        selectedIDs,
        handleCheck,
        handleUncheckAll,
        handleCheckElement,
        handleCheckRange,
    } = useMailboxSelection(labelID, elementID, elementIDs);

    useNewEmailNotification(() => handleUncheckAll());

    const showToolbar = !breakpoints.isNarrow || !elementID;
    const showList = columnMode || !elementID;
    const showContentPanel = (columnMode && !!expectedLength) || !!elementID;
    const showPlaceholder = !breakpoints.isNarrow && (!elementID || !!checkedIDs.length);
    const showContentView = showContentPanel && !!elementID;
    const elementIDForList = checkedIDs.length ? undefined : elementID;

    const { focusIndex, getFocusedId, setFocusIndex, handleFocus, focusOnLastMessage } = useMailboxFocus({
        elementIDs,
        showContentView,
        showList,
        listRef,
        labelID,
        loading,
    });

    const welcomeFlag = useWelcomeFlag([labelID, selectedIDs.length]);

    const handleElement = useCallback(
        (elementID: string | undefined) => {
            // Using the getter to prevent having elements in dependency of the callback
            const [element] = getElementsFromIDs([elementID || '']);

            if (isMessage(element) && isDraft(element)) {
                onCompose({ existingDraft: { localID: element.ID as string, data: element as Message } });
            }
            if (isConversationContentView && isMessage(element)) {
                history.push(
                    setParamsInLocation(history.location, {
                        labelID,
                        elementID: (element as Message).ConversationID,
                        messageID: element.ID,
                    })
                );
            } else {
                history.push(setParamsInLocation(history.location, { labelID, elementID: element.ID }));
            }
            focusOnLastMessage();
            handleUncheckAll();
        },
        [onCompose, isConversationContentView, labelID]
    );
    const handleBack = useCallback(() => history.push(setParamsInLocation(history.location, { labelID })), [labelID]);
    const handlePage = useCallback(
        (pageNumber: number) => history.push(setPageInUrl(history.location, pageNumber)),
        []
    );
    const handleSort = useCallback((sort: Sort) => history.push(setSortInUrl(history.location, sort)), []);
    const handleFilter = useCallback((filter: Filter) => history.push(setFilterInUrl(history.location, filter)), []);
    const handleNavigate = useCallback((labelID: string) => history.push(`/${labelID}`), []);

    // Move to the previous page if the current one becomes empty
    useEffect(() => {
        if (page.total && page.page >= pageCount(page)) {
            handlePage(page.page - 1);
        }
    }, [page]);

    const conversationMode = isConversationMode(labelID, mailSettings, location);

    const { elementRef, labelDropdownToggleRef, moveDropdownToggleRef } = useMailboxHotkeys(
        { labelID, elementID, elementIDs, checkedIDs, selectedIDs, focusIndex, columnLayout, showContentView },
        {
            focusOnLastMessage,
            getFocusedId,
            handleBack,
            handleCheck,
            handleCheckElement,
            handleCheckRange,
            handleElement,
            handleFilter,
            handleUncheckAll,
            setFocusIndex,
        }
    );

    return (
        <div ref={elementRef} tabIndex={-1} className="flex-item-fluid flex flex-column flex-nowrap no-outline">
            {showToolbar && (
                <Toolbar
                    labelID={labelID}
                    elementID={elementID}
                    selectedIDs={selectedIDs}
                    elementIDs={elementIDs}
                    mailSettings={mailSettings}
                    columnMode={columnMode}
                    conversationMode={conversationMode}
                    breakpoints={breakpoints}
                    onCheck={handleCheck}
                    page={page}
                    onPage={handlePage}
                    sort={sort}
                    onSort={handleSort}
                    filter={filter}
                    onFilter={handleFilter}
                    onBack={handleBack}
                    onElement={handleElement}
                    onNavigate={handleNavigate}
                    labelDropdownToggleRef={labelDropdownToggleRef}
                    moveDropdownToggleRef={moveDropdownToggleRef}
                />
            )}
            <PrivateMainArea className="flex" hasToolbar={showToolbar} hasRowMode={!showContentPanel}>
                {showList && (
                    <List
                        ref={listRef}
                        conversationMode={conversationMode}
                        labelID={labelID}
                        loading={loading}
                        expectedLength={expectedLength}
                        columnLayout={columnLayout}
                        mailSettings={mailSettings}
                        elementID={elementIDForList}
                        elements={elements}
                        checkedIDs={checkedIDs}
                        onCheck={handleCheck}
                        onClick={handleElement}
                        userSettings={userSettings}
                        isSearch={isSearch}
                        breakpoints={breakpoints}
                        page={page}
                        onPage={handlePage}
                        onFocus={handleFocus}
                        onCheckElement={handleCheckElement}
                        onCheckRange={handleCheckRange}
                    />
                )}
                {showContentPanel && (
                    <section className="view-column-detail flex flex-column flex-item-fluid no-scroll relative">
                        {showPlaceholder && (
                            <PlaceholderView
                                welcomeFlag={welcomeFlag}
                                location={location}
                                labelID={labelID}
                                mailSettings={mailSettings}
                                checkedIDs={checkedIDs}
                                onUncheckAll={handleUncheckAll}
                            />
                        )}
                        {showContentView &&
                            (isConversationContentView ? (
                                <ConversationView
                                    hidden={showPlaceholder}
                                    labelID={labelID}
                                    messageID={messageID}
                                    mailSettings={mailSettings}
                                    conversationID={elementID as string}
                                    onBack={handleBack}
                                    onCompose={onCompose}
                                    breakpoints={breakpoints}
                                />
                            ) : (
                                <MessageOnlyView
                                    hidden={showPlaceholder}
                                    labelID={labelID}
                                    mailSettings={mailSettings}
                                    messageID={elementID as string}
                                    onBack={handleBack}
                                    onCompose={onCompose}
                                    breakpoints={breakpoints}
                                />
                            ))}
                    </section>
                )}
            </PrivateMainArea>
        </div>
    );
};

export default memo(MailboxContainer);
