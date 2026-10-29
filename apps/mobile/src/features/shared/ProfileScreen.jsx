import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { ScreenHeader, Card, Badge } from "@/components/ui";
import { Avatar, MenuRow, SectionTitle, GradientHero } from "@/components/design";
import { Button } from "@/components/ui";
import { useAuthStore } from "@/stores/authStore";
import { useLogout } from "@/features/auth/api";
import { colors, spacing } from "@/theme";
import { BrandFooter } from "@/components/BrandFooter";
import { WideLogo } from "@/components/BrandLogo";
import { openWebsite } from "@/components/WebsiteButton";

/**
 * Worker: "Services" hub. Manager/Admin: "More" hub.
 * Menu adapts to role AND to where the screen lives (worker Services stack
 * vs manager More stack) — it detects available routes by role only, since
 * both stacks register these route names.
 */
export function ProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();
  const navigation = useNavigation();
  const role = user?.baseRole ?? user?.role;
  const isWorker = role === "WORKER";
  const isAdmin = role === "SUPER_ADMIN";

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ScreenHeader title={isWorker ? "Services" : "More"} subtitle="Ananta Infratech Solutions" />

      <GradientHero style={{ marginBottom: spacing.sm }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <Avatar name={user?.name ?? "?"} size={52} />
          <View style={{ flex: 1 }}>
            <Text style={styles.heroName}>{user?.name ?? "—"}</Text>
            <Text style={styles.heroMeta}>{user?.phone ?? ""}</Text>
          </View>
          <Badge label={role?.replace("_", " ") ?? ""} tone="amber" />
        </View>
      </GradientHero>

      {isWorker && (
        <>
          <SectionTitle>My work</SectionTitle>
          <MenuRow delay={40} icon="id-card-outline" tint={colors.gold} label="Digital ID Card" sub="Show at the site gate" onPress={() => navigation.navigate("IdCard")} />
          <MenuRow delay={70} icon="document-text-outline" tint={colors.sky} label="My Documents" sub="Aadhaar, PAN & verification status" onPress={() => navigation.navigate("WorkerDocuments")} />
          <MenuRow delay={100} icon="cash-outline" tint={colors.amber} label="Request Advance" sub="Advance against this month's salary" onPress={() => navigation.navigate("RequestAdvance")} />
          <MenuRow delay={130} icon="receipt-outline" tint={colors.rust} label="Request Kharchi" sub="Daily expense (kharchi)" onPress={() => navigation.navigate("RequestKharchi")} />
          <MenuRow delay={160} icon="airplane-outline" tint={colors.violet} label="Leave" sub="Request leave & track approvals" onPress={() => navigation.navigate("Leave")} />
        </>
      )}

      {!isWorker && (
        <>
          <SectionTitle>Operations</SectionTitle>
          <MenuRow delay={40} icon="cash-outline" tint={colors.amber} label="Submit Advance" sub="On behalf of a worker" onPress={() => navigation.navigate("SubmitAdvance")} />
          <MenuRow delay={70} icon="receipt-outline" tint={colors.rust} label="Submit Kharchi" sub="Daily kharchi for a worker" onPress={() => navigation.navigate("SubmitKharchi")} />
          <MenuRow delay={100} icon="airplane-outline" tint={colors.violet} label="Leave Requests" sub="Approve / reject worker leave" onPress={() => navigation.navigate("Leave")} />
        </>
      )}

      <SectionTitle>Company</SectionTitle>
      <MenuRow delay={190} icon="megaphone-outline" tint={colors.teal} label="Announcements" sub={isAdmin ? "Publish & manage company notices" : "Official company notices"} onPress={() => navigation.navigate("Announcements")} />
      <MenuRow delay={220} icon="notifications-outline" tint={colors.graphite700} label="Notifications" onPress={() => navigation.navigate("Notifications")} />
      <MenuRow delay={250} icon="chatbubbles-outline" tint={colors.graphite700} label="Support" sub="Chat with the office" onPress={() => navigation.navigate("Support")} />
      <MenuRow delay={280} icon="globe-outline" tint={colors.teal} label="Visit our website" sub="anantainfratechsolutions.com — know more about us" onPress={openWebsite} />

      <SectionTitle>Account</SectionTitle>
      <Card style={{ gap: spacing.sm, marginBottom: spacing.md }}>
        <Row label="Name" value={user?.name ?? "—"} />
        <Row label="Phone" value={user?.phone ?? "—"} />
        <Row label="Role" value={role?.replace("_", " ") ?? "—"} />
        <Row label="App" value="Ananta Infratech v1.0.0" />
      </Card>
      <SectionTitle>About</SectionTitle>
      <Card style={{ gap: spacing.sm, marginBottom: spacing.md }}>
        <WideLogo width={210} style={{ alignSelf: "center", marginBottom: spacing.sm, shadowOpacity: 0, elevation: 0 }} />
        <Row label="Company" value="Ananta Infratech Solutions" />
        <Row label="Website" value="anantainfratechsolutions.com" />
        <Row label="Developed & maintained by" value="Shourya" />
        <Row label="Support" value="Chat with the office (Support)" />
      </Card>
      <Button title="Sign out" onPress={() => logout.mutate()} variant="danger" />
      <BrandFooter />
    </ScrollView>
  );
}

function Row({ label, value }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { padding: spacing.lg },
  heroName: { fontSize: 17, fontWeight: "800", color: colors.white },
  heroMeta: { fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 2 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  label: { fontSize: 13, color: colors.graphite500 },
  value: { fontSize: 13, fontWeight: "700", color: colors.graphite900 },
  footer: { fontSize: 11, color: colors.graphite300, textAlign: "center", marginTop: spacing.lg }
});
