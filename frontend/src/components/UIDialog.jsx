/*
 * Copyright (c) 2026 Gustavo Alejandro Medde.
 * Licensed under the Apache License, Version 2.0.
 * See LICENSE.md in the project root for more information.
 */

import React, { useEffect } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import useUIStore from '../store/uiStore';

const UIDialog = () => {
  const { dialog, closeDialog } = useUIStore();

  const handleConfirm = () => {
    if (dialog.onConfirm) {
      dialog.onConfirm();
    }
    closeDialog();
  };

  const handleCancel = () => {
    if (dialog.onCancel) {
      dialog.onCancel();
    }
    closeDialog();
  };

  // Explicit Enter key listener for extra reliability across browsers/states
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (dialog.isOpen && e.key === 'Enter') {
        // Prevent accidental double-submits or form triggers
        e.preventDefault();
        handleConfirm();
      }
    };

    if (dialog.isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dialog.isOpen, dialog.onConfirm]);

  return (
    <AlertDialog open={dialog.isOpen} onOpenChange={(open) => !open && closeDialog()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{dialog.title}</AlertDialogTitle>
          <AlertDialogDescription>
            {dialog.description || ""}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {dialog.type === 'confirm' && (
            <AlertDialogCancel onClick={handleCancel}>
              {dialog.cancelText || 'Cancel'}
            </AlertDialogCancel>
          )}
          <AlertDialogAction 
            onClick={handleConfirm} 
            autoFocus
            className={dialog.variant === 'destructive' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
          >
            {dialog.confirmText || 'OK'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default UIDialog;
