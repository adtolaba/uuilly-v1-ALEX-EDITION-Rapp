/*
 * Copyright (c) 2026 Gustavo Alejandro Medde.
 * Licensed under the Apache License, Version 2.0.
 * See LICENSE.md in the project root for more information.
 */

import { create } from 'zustand';
import { toast } from 'sonner';

const useUIStore = create((set) => ({
  dialog: {
    isOpen: false,
    title: '',
    description: '',
    onConfirm: null,
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    type: 'alert', // 'alert' or 'confirm'
  },
  
  openAlert: (titleOrObj, description, confirmText = 'OK') => {
    let title = titleOrObj;
    let desc = description;
    let btnText = confirmText;

    if (typeof titleOrObj === 'object' && titleOrObj !== null) {
      title = titleOrObj.title;
      desc = titleOrObj.description;
      btnText = titleOrObj.confirmText || 'OK';
    }

    set({
      dialog: {
        isOpen: true,
        title,
        description: desc,
        onConfirm: null,
        confirmText: btnText,
        cancelText: 'Cancel',
        type: 'alert',
      }
    });
  },
  
  openConfirm: (titleOrObj, description, onConfirm, confirmText = 'Confirm', cancelText = 'Cancel', variant = 'default') => {
    let title = titleOrObj;
    let desc = description;
    let onConf = onConfirm;
    let confText = confirmText;
    let cancText = cancelText;
    let v = variant;

    if (typeof titleOrObj === 'object' && titleOrObj !== null) {
      title = titleOrObj.title;
      desc = titleOrObj.description;
      onConf = titleOrObj.onConfirm;
      confText = titleOrObj.confirmText || 'Confirm';
      cancText = titleOrObj.cancelText || 'Cancel';
      v = titleOrObj.variant || 'default';
    }

    return new Promise((resolve) => {
      const handleConfirm = () => {
        if (onConf) onConf();
        resolve(true);
      };
      
      const handleCancel = () => {
        resolve(false);
      };

      set({
        dialog: {
          isOpen: true,
          title,
          description: desc,
          onConfirm: handleConfirm,
          onCancel: handleCancel,
          confirmText: confText,
          cancelText: cancText,
          variant: v,
          type: 'confirm',
        }
      });
    });
  },
  
  closeDialog: () => set((state) => ({
    dialog: { ...state.dialog, isOpen: false }
  })),

  // Toast wrappers for convenience
  toast: {
    success: (message, options) => toast.success(message, options),
    error: (message, options) => toast.error(message, options),
    info: (message, options) => toast.info(message, options),
    warning: (message, options) => toast.warning(message, options),
  }
}));

export default useUIStore;
