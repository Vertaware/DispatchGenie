"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { IoChevronDown } from "react-icons/io5";
import { navigationItems } from "~/domain/constants/navigation";
import type { NavigationItem } from "~/domain/entities/navigation.entity";
import { UserRole } from "~/domain/enums/enum";
import useAuth from "~/presentation/hooks/useAuth";
import { useSidebar } from "~/shared/contexts";
import { cn } from "~/shared/utils/cn";

function Sidebar({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { isSidebarExpanded, toggleSidebar } = useSidebar();
  const [expandedItems, setExpandedItems] = useState<string[]>(["Payments"]);

  const { session } = useAuth();
  // Get user role from session
  const userRole = (session?.user as any)?.user?.role as UserRole | undefined;

  const toggleExpanded = (title: string) => {
    setExpandedItems((prev) =>
      prev.includes(title) ? prev.filter((item) => item !== title) : [...prev, title],
    );
  };

  const isActive = (itemPath: string) => {
    if (itemPath === "#") return false;
    if (itemPath === pathname) return true;
    return pathname.startsWith(itemPath);
  };

  const isChildActive = (children: { path: string }[]) => {
    return children.some((child) => isActive(child.path));
  };

  // Filter navigation items based on user role
  const filteredNavigationItems = useMemo(() => {
    const hasRoleAccess = (roles?: UserRole[]): boolean => {
      if (!roles || roles.length === 0) return true;
      return userRole ? roles.includes(userRole) : false;
    };

    return navigationItems
      .filter((item) => hasRoleAccess(item.roles))
      .map((item) => {
        if (item.hasChildren && item.children) {
          const filteredChildren = item.children.filter((child) => hasRoleAccess(child.roles));
          return filteredChildren.length > 0 ? { ...item, children: filteredChildren } : null;
        }
        return item;
      })
      .filter((item): item is NavigationItem => item !== null);
  }, [userRole]);

  return (
    <div className="flex h-screen">
      <aside
        className={cn(
          "flex flex-col bg-white transition-all duration-300 ease-in-out",
          isSidebarExpanded ? "w-64" : "w-20",
        )}
      >
        {/* Header Section */}
        <div
          className={cn(
            "flex items-center p-4",
            isSidebarExpanded ? "justify-between" : "justify-center",
          )}
        >
          {isSidebarExpanded && (
            <div className="flex items-center gap-3">
              {/* Logo with purple background */}
              <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-[#626bf5]">
                <Image
                  src="/images/logo.svg"
                  alt="Logo"
                  width={20}
                  height={20}
                  className="brightness-0 invert"
                />
              </div>
              <span className="whitespace-nowrap text-base font-semibold text-gray-900">
                LogisticsPro
              </span>
            </div>
          )}
          <button
            onClick={toggleSidebar}
            className="rounded p-1 transition-colors hover:bg-gray-200"
          >
            <Image src="/images/collapse.svg" alt="Collapse" width={20} height={20} />
          </button>
        </div>
        {/* Navigation */}
        <nav className={cn("flex-1 py-4 space-y-1", isSidebarExpanded ? "px-3" : "px-2")}>
          {filteredNavigationItems.map((item, index) => {
            const isItemActive = isActive(item.path);
            const isExpanded = expandedItems.includes(item.title);
            const hasActiveChild = item.children ? isChildActive(item.children) : false;

            return (
              <div key={index}>
                {item.hasChildren ? (
                  <>
                    <button
                      onClick={() => toggleExpanded(item.title)}
                      className={cn(
                        "w-full flex items-center justify-between py-2.5 rounded-lg transition-all duration-200 ease-in-out cursor-pointer hover:bg-gray-200",
                        isSidebarExpanded ? "px-4" : "px-2 justify-center",
                        (isItemActive || hasActiveChild) && "bg-gray-200",
                      )}
                    >
                      <div
                        className={cn(
                          "flex items-center",
                          isSidebarExpanded ? "gap-3" : "justify-center",
                        )}
                      >
                        <div
                          className={cn(
                            "w-5 h-5 flex items-center justify-center",
                            isItemActive || hasActiveChild ? "text-[#626bf5]" : "text-gray-700",
                          )}
                        >
                          {item.icon}
                        </div>
                        {isSidebarExpanded && (
                          <span
                            className={cn(
                              "text-sm font-medium",
                              isItemActive || hasActiveChild ? "text-gray-900" : "text-gray-700",
                            )}
                          >
                            {item.title}
                          </span>
                        )}
                      </div>
                      {isSidebarExpanded && (
                        <IoChevronDown
                          className={cn(
                            "w-4 h-4 transition-transform flex-shrink-0",
                            isExpanded ? "rotate-0" : "-rotate-90",
                            isItemActive || hasActiveChild ? "text-gray-700" : "text-gray-500",
                          )}
                        />
                      )}
                    </button>
                    {isExpanded && isSidebarExpanded && item.children && (
                      <div className="ml-4 mt-1 space-y-0.5 pl-4 transition-all duration-300 ease-in-out">
                        {item.children.map((child, childIndex) => {
                          const isChildItemActive = isActive(child.path);
                          return (
                            <Link
                              key={childIndex}
                              href={child.path}
                              className={cn(
                                "block px-4 py-2 text-sm rounded-lg transition-all duration-200 ease-in-out cursor-pointer",
                                isChildItemActive
                                  ? "text-gray-900 font-medium"
                                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50",
                              )}
                            >
                              {child.title}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </>
                ) : (
                  <Link
                    href={item.path}
                    className={cn(
                      "flex items-center py-2.5 rounded-lg transition-all duration-200 ease-in-out cursor-pointer hover:bg-gray-200",
                      isSidebarExpanded ? "px-4 gap-3" : "px-2 justify-center",
                      isItemActive && "bg-gray-200",
                    )}
                  >
                    <div
                      className={cn(
                        "w-5 h-5 flex items-center justify-center",
                        isItemActive ? "text-[#626bf5]" : "text-gray-700",
                      )}
                    >
                      {item.icon}
                    </div>
                    {isSidebarExpanded && (
                      <span
                        className={cn(
                          "text-sm font-medium",
                          isItemActive ? "text-gray-900" : "text-gray-700",
                        )}
                      >
                        {item.title}
                      </span>
                    )}
                  </Link>
                )}
              </div>
            );
          })}
        </nav>
      </aside>
      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}

export default Sidebar;
