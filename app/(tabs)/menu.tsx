import { MaterialIcons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { THEME } from "../../constants/theme";
import { useSession } from "../../context/SessionContext";
import { SessionService } from "../../services/session.service";

const DUMMY_MENU = [
  {
    id: 1,
    name: "Truffle Burger",
    price: 22.5,
    desc: "Wagyu beef, truffle aioli, caramelized onions, Gruyère cheese, brioche bun.",
    is_popular: true,
    is_veg: false,
    image_path:
      "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=300&auto=format&fit=crop",
  },
  {
    id: 2,
    name: "Basil Pesto Pasta",
    price: 18.9,
    desc: "Handmade linguine, house-made basil pesto, toasted pine nuts, parmesan.",
    is_popular: false,
    is_veg: true,
    image_path:
      "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?q=80&w=300&auto=format&fit=crop",
  },
];

const FALLBACK_CATEGORIES = [
  { id: 1, name: "Mains", items: DUMMY_MENU },
  { id: 2, name: "Appetizers", items: [] },
  { id: 3, name: "Drinks", items: [] },
  { id: 4, name: "Desserts", items: [] },
];

export default function MenuScreen() {
  const {
    cart,
    updateCart,
    cartTotalQty,
    cartTotalPrice,
    setMenuData,
    tableData,
    joinStatus,
    sessionToken,
    menuData,
    isPrimary,
    customerName,
  } = useSession();

  const [activeCategoryIndex, setActiveCategoryIndex] = useState(0);
  const [loadingMenu, setLoadingMenu] = useState(true);

  // Host State
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [activeGuests, setActiveGuests] = useState<any[]>([]);
  const [showRequestsModal, setShowRequestsModal] = useState(false);

  // 1. Fetch Menu
  useEffect(() => {
    const loadMenu = async () => {
      if (!tableData || !sessionToken) return;
      try {
        setLoadingMenu(true);
        const data = await SessionService.fetchMenu(
          tableData.rId,
          tableData.tId,
          tableData.token,
          sessionToken,
        );
        if (data && data.categories) {
          setMenuData(data);
        } else {
          setMenuData({ categories: FALLBACK_CATEGORIES });
        }
      } catch (e) {
        setMenuData({ categories: FALLBACK_CATEGORIES });
      } finally {
        setLoadingMenu(false);
      }
    };
    loadMenu();
  }, [tableData, sessionToken]);

  // 2. Polling for Host (Checks for incoming join requests)
  useEffect(() => {
    let interval: NodeJS.Timeout;

    const fetchHostData = async () => {
      // Guard against missing auth
      if (!tableData?.tId || !sessionToken) return;

      try {
        const res = await SessionService.getPendingRequests(
          tableData.tId,
          sessionToken,
        );
        setPendingRequests(res.pending || []);
        setActiveGuests(res.guests || []);

        // React optimizes this! If it's already true, it won't re-render.
        if (res.pending && res.pending.length > 0) {
          setShowRequestsModal(true);
        }
      } catch (e) {
        console.error("Failed to fetch host data", e);
      }
    };

    if (isPrimary && tableData?.tId && sessionToken) {
      fetchHostData(); // Fetch immediately
      interval = setInterval(fetchHostData, 5000); // Then poll every 5s
    }

    // Clean, stable dependency array
    return () => clearInterval(interval);
  }, [isPrimary, tableData?.tId, sessionToken]);

  // 3. Handle Host Action (Approve/Reject)
  const handleRequestResponse = async (
    id: number,
    action: "approve" | "reject",
  ) => {
    if (!sessionToken) return;

    try {
      // Pass the token to authenticate the approval
      await SessionService.respondToRequest(id, action, sessionToken);

      // Optimistically and safely update the request list (Closure safe!)
      setPendingRequests((prev) => {
        const updated = prev.filter((r) => r.id !== id);
        // If that was the last request, close the modal directly from the derived state
        if (updated.length === 0) {
          setShowRequestsModal(false);
        }
        return updated;
      });
    } catch (e) {
      console.error("Failed to respond to request", e);
    }
  };

  const categories = menuData?.categories || FALLBACK_CATEGORIES;
  const activeCategory = categories[activeCategoryIndex] || categories[0];
  const itemsToDisplay = activeCategory?.items || [];

  const isApproved = joinStatus === "active" || joinStatus === "approved";
  const isOrderingLocked = !isApproved;
  const restaurantName = menuData?.restaurant?.name || "Loading...";
  const restaurantLogo = menuData?.restaurant?.logo; // Pulls the URL from Laravel
  const tableNumber = menuData?.table?.number || tableData?.tId || "?";
  const tableCapacity = menuData?.table?.capacity || "-";
  const displayHostName = isPrimary
    ? customerName
    : menuData?.session?.host_name || "Host";
  return (
    <SafeAreaView style={styles.container}>
      {/* Top App Bar */}
      {/* Top App Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.iconBtn}>
          <MaterialIcons
            name="arrow-back"
            size={24}
            color={THEME.textPrimary}
          />
        </TouchableOpacity>

        {/* 🔥 NEW: Dynamic Header with Logo, Capacity, and Host */}
        <View style={styles.headerCenter}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 2,
            }}
          >
            {restaurantLogo ? (
              <Image
                source={{ uri: restaurantLogo }}
                style={styles.headerLogo}
              />
            ) : (
              <MaterialIcons
                name="restaurant"
                size={16}
                color={THEME.primary}
                style={{ marginRight: 6 }}
              />
            )}
            <Text style={styles.topBarTitle}>
              Table {tableNumber} • {restaurantName}
            </Text>
          </View>

          <View style={styles.tableSubInfo}>
            <MaterialIcons
              name="groups"
              size={12}
              color={THEME.textSecondary}
            />
            <Text style={styles.tableSubInfoText}>Cap: {tableCapacity}</Text>
            <Text style={styles.tableSubInfoDot}>•</Text>
            <MaterialIcons name="stars" size={12} color={THEME.warning} />
            <Text style={styles.tableSubInfoText}>Host: {displayHostName}</Text>
          </View>
        </View>

        {/* Host Badge / Info Icon */}
        {isPrimary ? (
          <TouchableOpacity
            style={[
              styles.hostBadge,
              pendingRequests.length > 0 && { backgroundColor: THEME.danger },
            ]}
            onPress={() => setShowRequestsModal(true)}
          >
            <MaterialIcons name="people" size={16} color="#FFF" />
            <Text style={styles.hostBadgeText}>
              {activeGuests.length + pendingRequests.length}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.iconBtn}>
            <MaterialIcons
              name="info-outline"
              size={24}
              color={THEME.textPrimary}
            />
          </TouchableOpacity>
        )}
      </View>

      {loadingMenu ? (
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <ActivityIndicator size="large" color={THEME.primary} />
          <Text style={{ marginTop: 12, color: THEME.textSecondary }}>
            Loading Menu...
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View
            style={[styles.banner, isOrderingLocked && styles.bannerLocked]}
          >
            <View>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                <MaterialIcons
                  name={isApproved ? "lock-open" : "lock"}
                  size={16}
                  color={isApproved ? THEME.success : THEME.warning}
                />
                <Text
                  style={[
                    styles.bannerTitle,
                    { color: isApproved ? THEME.success : THEME.warning },
                  ]}
                >
                  {isApproved ? "Ready to Order" : "Awaiting Approval"}
                </Text>
              </View>
              <Text style={styles.bannerSub}>
                {isApproved
                  ? "Tap an item below to add it to your cart."
                  : "Ordering is locked until host approves your table."}
              </Text>
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryScroll}
            contentContainerStyle={{ paddingHorizontal: 16 }}
          >
            {categories.map((cat: any, idx: number) => (
              <TouchableOpacity
                key={cat.id || idx}
                style={[
                  styles.categoryPill,
                  idx === activeCategoryIndex && styles.categoryPillActive,
                ]}
                onPress={() => setActiveCategoryIndex(idx)}
              >
                <Text
                  style={[
                    styles.categoryText,
                    idx === activeCategoryIndex && styles.categoryTextActive,
                  ]}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.menuSection}>
            <Text style={styles.sectionTitle}>
              {activeCategory?.name || "Items"}
            </Text>
            {itemsToDisplay.map((item: any) => {
              const currentQty = cart[item.id]?.qty || 0;
              const itemPrice = parseFloat(item.price) || 0;

              return (
                <View
                  key={item.id}
                  style={[styles.card, isOrderingLocked && { opacity: 0.6 }]}
                >
                  <Image
                    source={{
                      uri:
                        item.image ||
                        item.image_path ||
                        "https://via.placeholder.com/150",
                    }}
                    style={styles.cardImage}
                  />
                  <View style={styles.cardContent}>
                    <View>
                      <View style={styles.cardHeader}>
                        <Text style={styles.itemName}>{item.name}</Text>
                        <Text style={styles.itemPrice}>
                          ₹{itemPrice.toFixed(2)}
                        </Text>
                      </View>
                      <Text style={styles.itemDesc} numberOfLines={2}>
                        {item.description || item.desc}
                      </Text>
                    </View>

                    <View style={styles.cardFooter}>
                      <View style={{ flexDirection: "row", gap: 6 }}>
                        {item.is_popular && (
                          <View style={styles.badgePopular}>
                            <Text style={styles.badgePopularText}>POPULAR</Text>
                          </View>
                        )}
                        {item.is_veg && (
                          <View style={styles.badgeVeg}>
                            <Text style={styles.badgeVegText}>VEG</Text>
                          </View>
                        )}
                      </View>

                      {!isOrderingLocked &&
                        (currentQty > 0 ? (
                          <View style={styles.qtyControls}>
                            <TouchableOpacity
                              onPress={() =>
                                updateCart(item.id, -1, itemPrice, item.name)
                              }
                              style={styles.qtyBtn}
                            >
                              <MaterialIcons
                                name="remove"
                                size={16}
                                color={THEME.primary}
                              />
                            </TouchableOpacity>
                            <Text style={styles.qtyText}>{currentQty}</Text>
                            <TouchableOpacity
                              onPress={() =>
                                updateCart(item.id, 1, itemPrice, item.name)
                              }
                              style={styles.qtyBtn}
                            >
                              <MaterialIcons
                                name="add"
                                size={16}
                                color={THEME.primary}
                              />
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <TouchableOpacity
                            style={styles.addBtn}
                            onPress={() =>
                              updateCart(item.id, 1, itemPrice, item.name)
                            }
                          >
                            <Text style={styles.addBtnText}>+ Add</Text>
                          </TouchableOpacity>
                        ))}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}

      {cartTotalQty > 0 && !isOrderingLocked && (
        <View style={styles.cartBar}>
          <TouchableOpacity style={styles.cartButton}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              <View style={styles.cartIconWrapper}>
                <MaterialIcons
                  name="shopping-basket"
                  size={20}
                  color={THEME.primary}
                />
              </View>
              <View>
                <Text style={styles.cartQty}>{cartTotalQty} items</Text>
                <Text style={styles.cartTotal}>
                  ${cartTotalPrice.toFixed(2)}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={styles.viewCartText}>View Cart</Text>
              <MaterialIcons name="chevron-right" size={24} color="#FFF" />
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* --- HOST DASHBOARD MODAL --- */}
      <Modal visible={showRequestsModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Table Management</Text>
              <TouchableOpacity onPress={() => setShowRequestsModal(false)}>
                <MaterialIcons
                  name="cancel"
                  size={28}
                  color={THEME.textSecondary}
                />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.sectionHeader}>Join Requests</Text>
              {pendingRequests.length === 0 ? (
                <Text style={styles.emptyText}>No pending requests.</Text>
              ) : (
                pendingRequests.map((r) => (
                  <View key={r.id} style={styles.requestRow}>
                    <View
                      style={{ flexDirection: "row", alignItems: "center" }}
                    >
                      <MaterialIcons
                        name="person-add"
                        size={20}
                        color={THEME.warning}
                        style={{ marginRight: 8 }}
                      />
                      <Text style={styles.requestName}>{r.customer_name}</Text>
                    </View>
                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <TouchableOpacity
                        onPress={() => handleRequestResponse(r.id, "reject")}
                        style={[
                          styles.actionBtn,
                          { backgroundColor: THEME.danger + "20" },
                        ]}
                      >
                        <MaterialIcons
                          name="close"
                          color={THEME.danger}
                          size={20}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleRequestResponse(r.id, "approve")}
                        style={[
                          styles.actionBtn,
                          { backgroundColor: THEME.success + "20" },
                        ]}
                      >
                        <MaterialIcons
                          name="check"
                          color={THEME.success}
                          size={20}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}

              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: 24,
                  marginBottom: 12,
                }}
              >
                <Text style={[styles.sectionHeader, { marginBottom: 0 }]}>
                  Active Guests
                </Text>
                <View
                  style={{
                    backgroundColor: THEME.border,
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: 12,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "bold",
                      color: THEME.textSecondary,
                    }}
                  >
                    {activeGuests.length + 1} / {tableCapacity} Seats
                  </Text>
                </View>
              </View>
              {activeGuests.length === 0 ? (
                <Text style={styles.emptyText}>No guests have joined yet.</Text>
              ) : (
                activeGuests.map((g) => (
                  <View key={g.id} style={styles.requestRow}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <View
                        style={{
                          backgroundColor: THEME.successLight,
                          padding: 6,
                          borderRadius: 20,
                        }}
                      >
                        <MaterialIcons
                          name="person"
                          size={16}
                          color={THEME.success}
                        />
                      </View>
                      <Text style={styles.requestName}>{g.customer_name}</Text>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.background },
  // Add these inside styles:
  headerCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  headerLogo: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 6,
    backgroundColor: THEME.border,
  },
  tableSubInfo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  tableSubInfoText: {
    fontSize: 11,
    fontWeight: "600",
    color: THEME.textSecondary,
  },
  tableSubInfoDot: {
    fontSize: 10,
    color: THEME.textSecondary,
    marginHorizontal: 2,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "rgba(250, 250, 250, 0.95)",
  },
  iconBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 20,
  },
  topBarTitle: { fontSize: 16, fontWeight: "bold", color: THEME.textPrimary },
  hostBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: THEME.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  hostBadgeText: { color: "#FFF", fontWeight: "bold", fontSize: 14 },
  scrollContent: { paddingBottom: 100 },

  // Banner
  banner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: THEME.successLight,
    borderWidth: 1,
    borderColor: "rgba(76, 175, 80, 0.2)",
    padding: 16,
    marginHorizontal: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  bannerLocked: {
    backgroundColor: "rgba(255, 193, 7, 0.1)",
    borderColor: "rgba(255, 193, 7, 0.3)",
  },
  bannerTitle: { fontSize: 14, fontWeight: "bold", color: THEME.success },
  bannerSub: { fontSize: 12, color: THEME.textSecondary, marginTop: 4 },

  // Categories
  categoryScroll: { marginBottom: 24, maxHeight: 40 },
  categoryPill: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: THEME.border,
    backgroundColor: THEME.cardBg,
    marginRight: 8,
    justifyContent: "center",
  },
  categoryPillActive: {
    backgroundColor: THEME.primary,
    borderColor: THEME.primary,
  },
  categoryText: { fontSize: 14, fontWeight: "600", color: THEME.textSecondary },
  categoryTextActive: { color: "#FFF", fontWeight: "bold" },

  // Menu Section
  menuSection: { paddingHorizontal: 16 },
  sectionTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: THEME.textPrimary,
    marginBottom: 16,
  },

  // Menu Card
  card: {
    flexDirection: "row",
    backgroundColor: THEME.cardBg,
    padding: 12,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: THEME.border,
    ...Platform.select({
      web: { boxShadow: "0px 2px 6px rgba(0,0,0,0.05)" } as any,
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
      },
    }),
  },
  cardImage: {
    width: 100,
    height: 100,
    borderRadius: 12,
    marginRight: 16,
    backgroundColor: THEME.border,
  },
  cardContent: { flex: 1, justifyContent: "space-between" },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  itemName: {
    fontSize: 16,
    fontWeight: "bold",
    color: THEME.textPrimary,
    flex: 1,
    paddingRight: 8,
  },
  itemPrice: { fontSize: 16, fontWeight: "bold", color: THEME.primary },
  itemDesc: { fontSize: 13, color: THEME.textSecondary, lineHeight: 18 },

  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
  },
  badgePopular: {
    backgroundColor: THEME.primaryLight,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgePopularText: {
    fontSize: 9,
    fontWeight: "bold",
    color: THEME.primary,
    letterSpacing: 0.5,
  },
  badgeVeg: {
    backgroundColor: THEME.successLight,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeVegText: {
    fontSize: 9,
    fontWeight: "bold",
    color: THEME.success,
    letterSpacing: 0.5,
  },

  addBtn: {
    backgroundColor: THEME.primary,
    paddingHorizontal: 20,
    height: 32,
    justifyContent: "center",
    borderRadius: 8,
  },
  addBtnText: { color: "#FFF", fontWeight: "bold", fontSize: 13 },
  qtyControls: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 8,
    height: 32,
  },
  qtyBtn: { paddingHorizontal: 8, height: "100%", justifyContent: "center" },
  qtyText: {
    fontWeight: "bold",
    fontSize: 14,
    width: 20,
    textAlign: "center",
    color: THEME.textPrimary,
  },

  // Cart Footer
  cartBar: { position: "absolute", bottom: 16, left: 16, right: 16 },
  cartButton: {
    backgroundColor: THEME.primary,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    ...Platform.select({
      web: { boxShadow: "0px 4px 12px rgba(255, 107, 53, 0.3)" } as any,
      default: {
        shadowColor: THEME.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
      },
    }),
  },
  cartIconWrapper: {
    width: 36,
    height: 36,
    backgroundColor: "#FFF",
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  cartQty: { color: "rgba(255,255,255,0.9)", fontSize: 12, fontWeight: "600" },
  cartTotal: { color: "#FFF", fontSize: 18, fontWeight: "bold" },
  viewCartText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "bold",
    marginRight: 4,
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(28,28,30,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "white",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderColor: THEME.border,
  },
  modalTitle: { fontSize: 20, fontWeight: "bold", color: THEME.textPrimary },
  sectionHeader: {
    fontSize: 13,
    fontWeight: "bold",
    color: THEME.textSecondary,
    textTransform: "uppercase",
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  emptyText: {
    color: THEME.textSecondary,
    fontStyle: "italic",
    paddingVertical: 10,
  },
  requestRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: THEME.border,
  },
  requestName: { fontSize: 16, fontWeight: "600", color: THEME.textPrimary },
  actionBtn: { padding: 8, borderRadius: 8 },
});
