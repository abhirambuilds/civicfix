import { AuthenticatedUser } from './auth.types.js';
import {
  OrganizationMembershipContext,
  DepartmentMembershipContext,
} from './rbac.types.js';

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      orgMembership?: OrganizationMembershipContext;
      deptMembership?: DepartmentMembershipContext;
    }
  }
}

export {};
