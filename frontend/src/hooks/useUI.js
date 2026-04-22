/*
 * Copyright (c) 2026 Gustavo Alejandro Medde.
 * Licensed under the Apache License, Version 2.0.
 * See LICENSE.md in the project root for more information.
 */

import useUIStore from '../store/uiStore';

const useUI = () => {
  const store = useUIStore();
  
  return {
    alert: store.openAlert,
    confirm: store.openConfirm,
    toast: store.toast,
    close: store.closeDialog,
    dialog: store.dialog,
  };
};

export default useUI;
