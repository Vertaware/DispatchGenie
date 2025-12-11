import { BaseEntity } from '../common/base.entity';
import { UserRole } from '~/enums/index';

export interface UserProps {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date | null;
}

export class User extends BaseEntity<UserProps> {
  static create(props: UserProps): User {
    return new User(props);
  }

  get role(): UserRole {
    return this.props.role;
  }
}
