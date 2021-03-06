import React, { useState } from 'react';
import { AppLink, Button, Icon } from 'react-components';
import { c } from 'ttag';
import { APPS } from 'proton-shared/lib/constants';
import { MessageExtended, MessageErrors } from '../../../models/message';
import { useMessage } from '../../../hooks/message/useMessage';
import { useReloadMessage } from '../../../hooks/message/useLoadMessage';

const getTranslations = (key: keyof MessageErrors, alreadyTried: boolean) => {
    switch (key) {
        case 'network':
            return c('Error').t`Network error: Please check your connection and try again.`;
        case 'decryption':
            return alreadyTried
                ? c('Error')
                      .t`Decryption error: we still cannot decrypt your message. Please verify that all your keys are active.`
                : c('Error').t`Decryption error: decryption of this message's encrypted content failed.`;
        case 'common':
        default:
            return c('Error').t`Message processing error.`;
    }
};

interface Props {
    message: MessageExtended;
}

const ExtraErrors = ({ message }: Props) => {
    const { addAction } = useMessage(message.localID);
    const reloadMessage = useReloadMessage(message.localID);

    const [alreadyTried, setAlreadyTried] = useState(false);

    const errorTypes = (Object.keys(message.errors || {}) as (keyof MessageErrors)[]).filter(
        (type) => message.errors?.[type]?.length
    );

    if (errorTypes.length === 0) {
        return null;
    }

    const handleReload = () => {
        void addAction(reloadMessage);
        setAlreadyTried(true);
    };

    // Using a Fragment here, is only to satisfy TS :(
    return (
        <>
            {errorTypes.map((errorType) => {
                const showReload = errorType === 'network' || (errorType === 'decryption' && !alreadyTried);
                const showKeysLink = errorType === 'decryption' && alreadyTried;

                return (
                    <div
                        key={errorType}
                        className="bg-global-warning color-white rounded p0-5 mb0-5 flex flex-nowrap flex-items-center"
                    >
                        <Icon name="attention" className="flex-item-noshrink mtauto mbauto" />
                        <span className="pl0-5 pr0-5 flex-item-fluid">{getTranslations(errorType, alreadyTried)}</span>
                        {showReload && (
                            <span className="flex-item-noshrink flex">
                                <Button onClick={handleReload} className=" pm-button--small">
                                    {c('Action').t`Try again`}
                                </Button>
                            </span>
                        )}
                        {showKeysLink && (
                            <span className="flex-item-noshrink flex">
                                <AppLink
                                    to="/settings/security"
                                    toApp={APPS.PROTONMAIL}
                                    className="underline color-currentColor mtauto"
                                >
                                    {c('Action').t`View keys`}
                                </AppLink>
                            </span>
                        )}
                    </div>
                );
            })}
        </>
    );
};

export default ExtraErrors;
