# Copyright (c) 2026 Gustavo Alejandro Medde.
# Licensed under the Apache License, Version 2.0.
# See LICENSE.md in the project root for more information.

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Body
from typing import List, Optional
import schemas
import auth
from database import get_db, prisma
from backup_service import BackupService
import json

router = APIRouter(prefix="/api/admin/backup", tags=["backup"])

@router.post("/export")
async def export_backup(
    request: schemas.BackupExportRequest,
    db=Depends(get_db),
    current_user: schemas.User = Depends(auth.get_current_admin_user)
):
    """Generates a JSON backup of selected categories (Admin only)."""
    backup_service = BackupService(db)
    try:
        backup_file = await backup_service.export_data(
            categories=request.categories,
            created_by=current_user.email,
            description=request.description
        )
        return backup_file
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")

@router.post("/import")
async def import_backup(
    file: UploadFile = File(...),
    categories: str = Form(...), # JSON string of list
    overwrite: bool = Form(False),
    db=Depends(get_db),
    current_user: schemas.User = Depends(auth.get_current_admin_user)
):
    """Imports data from a JSON backup file (Admin only)."""
    try:
        content = await file.read()
        backup_dict = json.loads(content)
        backup_file = schemas.BackupFile(**backup_dict)
        
        parsed_categories = json.loads(categories)
        
        backup_service = BackupService(db)
        stats = await backup_service.import_data(
            backup=backup_file,
            categories=parsed_categories,
            overwrite=overwrite,
            imported_by=current_user.email
        )
        return {"status": "success", "stats": stats}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Import failed: {str(e)}")

@router.post("/reset")
async def reset_system(
    confirmation: str = Body(..., embed=True),
    db=Depends(get_db),
    current_user: schemas.User = Depends(auth.get_current_admin_user)
):
    """Wipes all system data except for Admin users (Admin only)."""
    if confirmation != "RESET":
        raise HTTPException(status_code=400, detail="Invalid confirmation word. Type 'RESET' to continue.")
    
    backup_service = BackupService(db)
    try:
        await backup_service.reset_system(initiated_by=current_user.email)
        return {"status": "success", "message": "System has been reset. All data except Admins cleared."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Reset failed: {str(e)}")

@router.get("/logs", response_model=List[schemas.BackupLog])
async def list_backup_logs(
    db=Depends(get_db),
    current_user: schemas.User = Depends(auth.get_current_admin_user)
):
    """Lists history of backup/restore actions (Admin only)."""
    return await db.backuplog.find_many(
        order={"timestamp": "desc"},
        include={"user": True}
    )
