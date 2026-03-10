import type { ReactNode } from "react";
import { Drawer as PanelDrawer, Sidebar } from "@/components";

export function TargetCatsLayout(props: {
  isMobile: boolean;
  title?: string;
  drawerOpen: boolean;
  onCloseDrawer: () => void;
  onHideDesktop?: () => void;
  children: ReactNode;
}) {
  const {
    isMobile,
    title = "選擇目標貓咪",
    drawerOpen,
    onCloseDrawer,
    onHideDesktop,
    children,
  } = props;

  if (isMobile) {
    return (
      <PanelDrawer
        title={title}
        open={drawerOpen}
        onRequestClose={onCloseDrawer}
        onClose={onCloseDrawer}
        closeAriaLabel="關閉目標貓列表"
      >
        {children}
      </PanelDrawer>
    );
  }

  return (
    <Sidebar title={title} onClose={onHideDesktop} closeAriaLabel="隱藏目標貓列表">
      {children}
    </Sidebar>
  );
}
