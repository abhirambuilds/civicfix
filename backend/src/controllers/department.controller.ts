import { Request, Response, NextFunction } from 'express';
import {
  createDepartment,
  listDepartments,
  getDepartmentById,
  updateDepartment,
  updateDepartmentStatus,
  listDepartmentMembers,
  addDepartmentMember,
  updateDepartmentMember,
  removeDepartmentMember,
} from '../services/department.service.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

export async function createDept(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user || !req.user.id) {
      sendError(res, 'Authentication required.', 401);
      return;
    }

    const result = await createDepartment(
      req.user.id,
      req.user.role,
      req.params.organizationId as string,
      req.body
    );

    if (!result.success) {
      sendError(res, result.error || 'Failed to create department', result.statusCode || 400);
      return;
    }

    sendSuccess(res, result.data, result.message || 'Department created successfully', 201);
  } catch (error) {
    next(error);
  }
}

export async function listDepts(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user || !req.user.id) {
      sendError(res, 'Authentication required.', 401);
      return;
    }

    const result = await listDepartments(
      req.user.id,
      req.user.role,
      req.params.organizationId as string
    );

    if (!result.success) {
      sendError(res, result.error || 'Failed to list departments', result.statusCode || 403);
      return;
    }

    sendSuccess(res, result.data, 'Departments retrieved successfully', 200);
  } catch (error) {
    next(error);
  }
}

export async function getDept(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user || !req.user.id) {
      sendError(res, 'Authentication required.', 401);
      return;
    }

    const result = await getDepartmentById(
      req.user.id,
      req.user.role,
      req.params.organizationId as string,
      req.params.departmentId as string
    );

    if (!result.success) {
      sendError(res, result.error || 'Failed to get department', result.statusCode || 404);
      return;
    }

    sendSuccess(res, result.data, 'Department details retrieved successfully', 200);
  } catch (error) {
    next(error);
  }
}

export async function updateDept(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user || !req.user.id) {
      sendError(res, 'Authentication required.', 401);
      return;
    }

    const result = await updateDepartment(
      req.user.id,
      req.user.role,
      req.params.organizationId as string,
      req.params.departmentId as string,
      req.body
    );

    if (!result.success) {
      sendError(res, result.error || 'Failed to update department', result.statusCode || 400);
      return;
    }

    sendSuccess(res, result.data, result.message || 'Department updated successfully', 200);
  } catch (error) {
    next(error);
  }
}

export async function updateDeptStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user || !req.user.id) {
      sendError(res, 'Authentication required.', 401);
      return;
    }

    const result = await updateDepartmentStatus(
      req.user.id,
      req.user.role,
      req.params.organizationId as string,
      req.params.departmentId as string,
      req.body.isActive
    );

    if (!result.success) {
      sendError(res, result.error || 'Failed to update department status', result.statusCode || 400);
      return;
    }

    sendSuccess(res, result.data, result.message || 'Status updated successfully', 200);
  } catch (error) {
    next(error);
  }
}

export async function listDeptMembers(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user || !req.user.id) {
      sendError(res, 'Authentication required.', 401);
      return;
    }

    const result = await listDepartmentMembers(
      req.user.id,
      req.user.role,
      req.params.organizationId as string,
      req.params.departmentId as string
    );

    if (!result.success) {
      sendError(res, result.error || 'Failed to list department members', result.statusCode || 403);
      return;
    }

    sendSuccess(res, result.data, 'Department members retrieved successfully', 200);
  } catch (error) {
    next(error);
  }
}

export async function addDeptMember(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user || !req.user.id) {
      sendError(res, 'Authentication required.', 401);
      return;
    }

    const result = await addDepartmentMember(
      req.user.id,
      req.user.role,
      req.params.organizationId as string,
      req.params.departmentId as string,
      req.body
    );

    if (!result.success) {
      sendError(res, result.error || 'Failed to add department member', result.statusCode || 400);
      return;
    }

    sendSuccess(res, result.data, result.message || 'Department member added successfully', result.statusCode || 201);
  } catch (error) {
    next(error);
  }
}

export async function updateDeptMember(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user || !req.user.id) {
      sendError(res, 'Authentication required.', 401);
      return;
    }

    const result = await updateDepartmentMember(
      req.user.id,
      req.user.role,
      req.params.organizationId as string,
      req.params.departmentId as string,
      req.params.userId as string,
      req.body
    );

    if (!result.success) {
      sendError(res, result.error || 'Failed to update department member', result.statusCode || 400);
      return;
    }

    sendSuccess(res, result.data, result.message || 'Department member updated successfully', 200);
  } catch (error) {
    next(error);
  }
}

export async function removeDeptMember(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user || !req.user.id) {
      sendError(res, 'Authentication required.', 401);
      return;
    }

    const result = await removeDepartmentMember(
      req.user.id,
      req.user.role,
      req.params.organizationId as string,
      req.params.departmentId as string,
      req.params.userId as string
    );

    if (!result.success) {
      sendError(res, result.error || 'Failed to remove department member', result.statusCode || 400);
      return;
    }

    sendSuccess(res, null, result.message || 'Department member removed successfully', 200);
  } catch (error) {
    next(error);
  }
}
