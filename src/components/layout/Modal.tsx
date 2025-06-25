import { Dialog, Transition } from '@headlessui/react';
import { Fragment, PropsWithChildren } from 'react';

import XCircle from '../../images/icons/x-circle.svg';
import { IconButton } from '../buttons/IconButton';

export function Modal({
  isOpen,
  title,
  close,
  width,
  padding,
  children,
  showCloseBtn = true,
}: PropsWithChildren<{
  isOpen: boolean;
  title?: string;
  close: () => void;
  width?: string;
  padding?: string;
  showCloseBtn?: boolean;
}>) {
  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-30" onClose={close}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center font-sans">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel
                className={`bg-white text-black w-full ${
                  width || 'max-w-xs'
                } md:min-h-[357px] mt-20 mr-2 max-h-[90vh] transform overflow-auto ${
                  padding || ''
                } text-left transition-all 
                border-border border-solid
                `}
                style={{ borderWidth: '0.5px', borderRadius: '5px' }}
              >
                {title ? (
                  <Dialog.Title
                    as="h3"
                    className="text text-black font-bold text-lg leading-6 mt-6 ml-8"
                  >
                    {title}
                  </Dialog.Title>
                ) : null}
                {children}
                {showCloseBtn && (
                  <div className="absolute right-4 top-7">
                    <IconButton
                      imgSrc={XCircle}
                      onClick={close}
                      title="Close"
                      classes="hover:rotate-90 bg-white"
                    />
                  </div>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
