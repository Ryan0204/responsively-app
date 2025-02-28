import { Icon } from '@iconify/react';
import cx from 'classnames';
import { IPC_MAIN_CHANNELS, OpenUrlArgs } from 'common/constants';
import { AuthRequestArgs } from 'main/http-basic-auth';
import { PermissionRequestArg } from 'main/web-permissions/PermissionsManager';
import {
  KeyboardEventHandler,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Button from 'renderer/components/Button';
import { webViewPubSub } from 'renderer/lib/pubsub';
import { selectAddress, setAddress } from 'renderer/store/features/renderer';
import AuthModal from './AuthModal';
import SuggestionList from './SuggestionList';
import Bookmark from './BookmarkButton';

export const ADDRESS_BAR_EVENTS = {
  DELETE_COOKIES: 'DELETE_COOKIES',
  DELETE_STORAGE: 'DELETE_STORAGE',
  DELETE_CACHE: 'DELETE_CACHE',
};

const AddressBar = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [typedAddress, setTypedAddress] = useState<string>('');
  const [isSuggesting, setIsSuggesting] = useState<boolean>(false);
  const [homepage, setHomepage] = useState<string>(
    window.electron.store.get('homepage')
  );
  const [deleteStorageLoading, setDeleteStorageLoading] =
    useState<boolean>(false);
  const [deleteCookiesLoading, setDeleteCookiesLoading] =
    useState<boolean>(false);
  const [deleteCacheLoading, setDeleteCacheLoading] = useState<boolean>(false);
  const [permissionRequest, setPermissionRequest] =
    useState<PermissionRequestArg | null>(null);
  const [authRequest, setAuthRequest] = useState<AuthRequestArgs | null>(null);
  const address = useSelector(selectAddress);
  const dispatch = useDispatch();

  useEffect(() => {
    if (address === typedAddress) {
      return;
    }
    setTypedAddress(address);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  const dispatchAddress = useCallback(
    (url?: string) => {
      let newAddress = url ?? typedAddress;
      if (newAddress.indexOf('://') === -1) {
        let protocol = 'https://';
        if (
          typedAddress.indexOf('localhost') !== -1 ||
          typedAddress.indexOf('127.0.0.1') !== -1
        ) {
          protocol = 'http://';
        }
        newAddress = protocol + typedAddress;
      }

      dispatch(setAddress(newAddress));
    },
    [dispatch, typedAddress]
  );

  useEffect(() => {
    window.electron.ipcRenderer.on<PermissionRequestArg>(
      IPC_MAIN_CHANNELS.PERMISSION_REQUEST,
      (args) => {
        setPermissionRequest(args);
      }
    );

    window.electron.ipcRenderer.on<AuthRequestArgs>(
      IPC_MAIN_CHANNELS.AUTH_REQUEST,
      (args) => {
        setAuthRequest(args);
      }
    );
    window.electron.ipcRenderer.on<OpenUrlArgs>(
      IPC_MAIN_CHANNELS.OPEN_URL,
      (args) => {
        dispatchAddress(args.url);
      }
    );

    return () => {
      window.electron.ipcRenderer.removeAllListeners(
        IPC_MAIN_CHANNELS.PERMISSION_REQUEST
      );
      window.electron.ipcRenderer.removeAllListeners(
        IPC_MAIN_CHANNELS.AUTH_REQUEST
      );
      window.electron.ipcRenderer.removeAllListeners(
        IPC_MAIN_CHANNELS.OPEN_URL
      );
    };
  }, [dispatchAddress]);

  useEffect(() => {
    if (homepage !== window.electron.store.get('homepage')) {
      window.electron.store.set('homepage', homepage);
    }
  }, [homepage]);

  const permissionReqClickHandler = (allow: boolean) => {
    if (!permissionRequest) {
      return;
    }
    window.electron.ipcRenderer.invoke(IPC_MAIN_CHANNELS.PERMISSION_RESPONSE, {
      permissionRequest,
      allow,
    });
    setPermissionRequest(null);
  };

  const handleKeyDown: KeyboardEventHandler<HTMLInputElement> = () => {
    if (!isSuggesting) {
      setIsSuggesting(true);
    }
  };

  const onEnter = (url?: string) => {
    dispatchAddress(url);
    inputRef.current?.blur();
  };

  const deleteCookies = async () => {
    setDeleteCookiesLoading(true);
    await webViewPubSub.publish(ADDRESS_BAR_EVENTS.DELETE_COOKIES);
    setDeleteCookiesLoading(false);
  };

  const deleteStorage = async () => {
    setDeleteStorageLoading(true);
    await webViewPubSub.publish(ADDRESS_BAR_EVENTS.DELETE_STORAGE);
    setDeleteStorageLoading(false);
  };

  const deleteCache = async () => {
    setDeleteCacheLoading(true);
    await webViewPubSub.publish(ADDRESS_BAR_EVENTS.DELETE_CACHE);
    setDeleteCacheLoading(false);
  };

  const isHomepage = address === homepage;

  return (
    <>
      <div className="relative z-10 w-full flex-grow">
        <div className="absolute top-2 left-2 mr-2 flex flex-col items-start">
          <Icon icon="mdi:web" className="text-gray-500" />
          {permissionRequest != null ? (
            <div className="z-40 mt-4 flex w-96 flex-col gap-8 rounded bg-white p-6 shadow-lg ring-1 ring-slate-500 !ring-opacity-40 focus:outline-none dark:bg-slate-900 dark:ring-white dark:!ring-opacity-40">
              <span>
                {permissionRequest.requestingOrigin} requests permission for:{' '}
                <br />
                <span className="flex justify-center font-bold capitalize">
                  {permissionRequest.permission}
                </span>
              </span>
              <div className="flex justify-end">
                <div className="flex w-1/2 justify-around">
                  <Button
                    onClick={() => {
                      permissionReqClickHandler(false);
                    }}
                    isActionButton
                  >
                    Block
                  </Button>
                  <Button
                    onClick={() => {
                      permissionReqClickHandler(true);
                    }}
                    isActionButton
                  >
                    Allow
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
        <input
          ref={inputRef}
          type="text"
          className={cx(
            'w-full text-ellipsis rounded-full px-2 py-1 pl-8 pr-20 dark:bg-slate-900',
            {
              'rounded-tl-lg rounded-tr-lg rounded-bl-none rounded-br-none outline-none':
                isSuggesting,
            }
          )}
          value={typedAddress}
          onChange={(e) => setTypedAddress(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            setTimeout(() => {
              setIsSuggesting(false);
            }, 100);
          }}
        />
        <div className="absolute inset-y-0 right-0 mr-2 flex items-center">
          <Button
            className="rounded-full"
            onClick={deleteStorage}
            isLoading={deleteStorageLoading}
            title="Delete Storage"
          >
            <Icon icon="mdi:database-remove-outline" />
          </Button>
          <Button
            className="rounded-full"
            onClick={deleteCookies}
            isLoading={deleteCookiesLoading}
            title="Delete Cookies"
          >
            <Icon icon="mdi:cookie-remove-outline" />
          </Button>
          <Button
            className="rounded-full"
            onClick={deleteCache}
            isLoading={deleteCacheLoading}
            title="Clear Cache"
          >
            <Icon icon="mdi:wifi-remove" />
          </Button>
          <Button
            className={cx('rounded-full', {
              'text-blue-500': isHomepage,
            })}
            onClick={() => setHomepage(address)}
            title="Homepage"
          >
            <Icon icon={isHomepage ? 'mdi:home' : 'mdi:home-outline'} />
          </Button>
          <Bookmark currentAddress={address} />
        </div>
        {isSuggesting ? (
          <SuggestionList match={typedAddress} onEnter={onEnter} />
        ) : null}
      </div>
      <AuthModal
        isOpen={authRequest != null}
        onClose={() => setAuthRequest(null)}
        authInfo={authRequest}
      />
    </>
  );
};

export default AddressBar;
