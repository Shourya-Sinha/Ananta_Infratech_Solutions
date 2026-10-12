import {
  BadgeCheck,
  Building2,
  Clock,
  Factory,
  HardHat,
  Handshake,
  Home,
  PaintRoller,
  Route,
  ShieldCheck,
  Star,
  Users,
  Wallet
} from "lucide-react";

// Icon names are stored as strings in CMS content, so the editor can pick them
// from a fixed list (see ICON_NAMES in the admin CMS schema).
export const ICONS = {
  BadgeCheck,
  Building2,
  Clock,
  Factory,
  HardHat,
  Handshake,
  Home,
  PaintRoller,
  Route,
  ShieldCheck,
  Star,
  Users,
  Wallet
};

export function Icon({ name, ...props }) {
  const Component = ICONS[name] || Star;
  return <Component aria-hidden="true" {...props} />;
}
