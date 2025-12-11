import { UserRole } from "../enums/enum";

interface Item {
  title: string;
  path: string;
  roles: UserRole[];
}

export interface NavigationItem {
  title: string;
  path: string;
  target?: string;
  icon: React.ReactElement;
  hasChildren?: boolean;
  children?: Item[];
  roles?: UserRole[];
}
