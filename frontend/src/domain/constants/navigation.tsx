import {
  MdAccountBalanceWallet,
  MdInventory2,
  MdLocalShipping,
  MdPeople,
  MdReceiptLong,
  MdSecurity,
} from "react-icons/md";
import { NavigationItem } from "../entities/navigation.entity";
import { UserRole } from "../enums/enum";

export const navigationItems: NavigationItem[] = [
  {
    title: "Sales Order",
    path: "/sales-orders",
    icon: <MdInventory2 />,
    roles: [UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.LOGISTIC_WORKER],
  },
  {
    title: "Vehicles",
    path: "/vehicles",
    icon: <MdLocalShipping />,
    roles: [UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.LOGISTIC_WORKER],
  },
  {
    title: "Payments",
    path: "#",
    icon: <MdAccountBalanceWallet />,
    hasChildren: true,
    children: [
      { title: "Add Payments", path: "/payments", roles: [UserRole.ADMIN, UserRole.ACCOUNTANT] },
      {
        title: "Transactions",
        path: "/transactions",
        roles: [UserRole.ADMIN, UserRole.ACCOUNTANT],
      },
      { title: "Beneficiary", path: "/beneficiary", roles: [UserRole.ADMIN, UserRole.ACCOUNTANT] },
    ],
  },
  {
    title: "Invoices",
    path: "/invoices",
    icon: <MdReceiptLong />,
    roles: [UserRole.ADMIN],
  },
  {
    title: "Gate",
    path: "/gate",
    icon: <MdSecurity />,
    roles: [UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.LOGISTIC_WORKER, UserRole.SECURITY],
  },
  {
    title: "Users",
    path: "/users",
    icon: <MdPeople />,
    roles: [UserRole.ADMIN],
  },
] as const;
