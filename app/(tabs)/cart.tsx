import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import uuid from "react-native-uuid";
import { THEME } from "../../constants/theme";
import { useSession } from "../../context/SessionContext";
import { OrderService } from "../../services/order.service";

const { width } = Dimensions.get("window");

// ─── Ann Sathi Brand Colors ───────────────────────────────────────────────────
const ANN = {
  orange: "#fe9a54",
  red: "#f16b3f",
  blue: "#456aba",
  darkBlue: "#2a4795",
  orangeLight: "#fff4ec",
  redLight: "#fff0eb",
  blueLight: "#eef2fb",
  darkBlueLight: "#e8ecf7",
};
// ─────────────────────────────────────────────────────────────────────────────

export default function CartTab() {
  const {
    cart,
    updateCart,
    cartTotalQty,
    cartTotalPrice,
    tableData,
    sessionToken,
    clearCart,
    menuData,
    clearSession,
  } = useSession();

  const [placing, setPlacing] = useState(false);
  const [itemNotes, setItemNotes] = useState<Record<number, string>>({});
  const [orderNote, setOrderNote] = useState("");
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const currency = menuData?.restaurant?.currency_symbol || "₹";

  useEffect(() => {
    setPendingKey(null);
  }, [cart, itemNotes, orderNote]);

  const handlePlaceOrder = async () => {
    if (placing) return;
    if (!sessionToken || cartTotalQty === 0) return;
    if (!tableData) {
      Alert.alert("Error", "Missing table connection.");
      return;
    }

    setPlacing(true);

    try {
      const idempotencyKey = pendingKey || uuid.v4().toString();
      if (!pendingKey) setPendingKey(idempotencyKey);

      const payload = Object.entries(cart)
        .filter(([_, item]) => item.qty > 0)
        .map(([id, item]) => ({
          menu_item_id: Number(id),
          quantity: item.qty,
          notes: itemNotes[Number(id)]?.trim() || null,
        }));

      await OrderService.placeOrder(
        tableData.rId,
        tableData.tId,
        sessionToken,
        payload,
        orderNote.trim(),
        idempotencyKey,
      );

      clearCart();
      setItemNotes({});
      setOrderNote("");
      setPendingKey(null);

      // 👇 THE FIX: Allow React state to settle before unmounting the screen
      setTimeout(() => {
        router.push("/(tabs)/orders");
      }, 100);
    } catch (err: any) {
      console.error("Order error:", err);

      if (
        err?.status === 403 ||
        err?.status === 404 ||
        err?.message?.toLowerCase().includes("expired")
      ) {
        Alert.alert(
          "Session Ended",
          "Your table session has been closed by the restaurant.",
        );
        await clearSession();
        router.replace("/");
        return;
      }

      Alert.alert(
        "Order Failed",
        err?.data?.message || err.message || "Network error. Please try again.",
      );
    } finally {
      setPlacing(false);
    }
  };

  const handleItemNoteChange = (id: number, text: string) => {
    setItemNotes((prev) => ({ ...prev, [id]: text }));
  };

  const confirmClearCart = () => {
    if (Platform.OS === "web") {
      const confirm = window.confirm(
        "Are you sure you want to clear your cart?",
      );
      if (confirm) clearCart();
      return;
    }
    Alert.alert("Clear Cart", "Are you sure you want to remove all items?", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear All", style: "destructive", onPress: clearCart },
    ]);
  };

  // ─── EMPTY CART STATE ───
  if (cartTotalQty === 0) {
    return (
      <View style={styles.mainWrapper}>
        <Image
          source={require("../../assets/images/bg.png")}
          style={styles.bgImage}
        />
        <View style={styles.bgOverlay} />

        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Your Cart</Text>
          </View>
          <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="cart-outline" size={60} color={ANN.orange} />
            </View>
            <Text style={styles.emptyTitle}>Your cart is empty</Text>
            <Text style={styles.emptySub}>
              Looks like you haven't added anything yet. Let's find some
              delicious food!
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/menu")}
              style={styles.browseBtn}
            >
              <Text style={styles.browseBtnText}>Browse Menu</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // ─── FULL CART STATE ───
  return (
    <View style={styles.mainWrapper}>
      <Image
        source={require("../../assets/images/bg.png")}
        style={styles.bgImage}
      />
      <View style={styles.bgOverlay} />

      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Review Order</Text>
            <TouchableOpacity
              onPress={confirmClearCart}
              style={styles.clearCartBtn}
            >
              <Ionicons name="trash-outline" size={20} color={THEME.danger} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeader}>Selected Items</Text>
              <Text style={styles.itemCountText}>{cartTotalQty} Items</Text>
            </View>

            {Object.entries(cart).map(([idStr, item]) => {
              const id = Number(idStr);
              if (item.qty <= 0) return null;

              return (
                <View key={id} style={styles.cartItemCard}>
                  <View style={styles.itemTopRow}>
                    <View style={{ flex: 1, paddingRight: 10 }}>
                      <Text style={styles.itemName} numberOfLines={2}>
                        {item.name}
                      </Text>
                      <Text style={styles.itemPrice}>
                        {currency}
                        {(item.price * item.qty).toFixed(2)}
                      </Text>
                    </View>

                    <View style={styles.controlsContainer}>
                      <TouchableOpacity
                        onPress={() =>
                          updateCart(id, -item.qty, item.price, item.name)
                        }
                        style={styles.deleteItemBtn}
                      >
                        <Ionicons name="trash" size={16} color={THEME.danger} />
                      </TouchableOpacity>

                      <View style={styles.qtySelector}>
                        <TouchableOpacity
                          onPress={() =>
                            updateCart(id, -1, item.price, item.name)
                          }
                          style={styles.qtyBtn}
                        >
                          <Ionicons
                            name="remove"
                            size={18}
                            color={ANN.darkBlue}
                          />
                        </TouchableOpacity>
                        <Text style={styles.qtyText}>{item.qty}</Text>
                        <TouchableOpacity
                          onPress={() =>
                            updateCart(id, 1, item.price, item.name)
                          }
                          style={styles.qtyBtn}
                        >
                          <Ionicons name="add" size={18} color={ANN.darkBlue} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  <View style={styles.noteInputContainer}>
                    <MaterialIcons
                      name="edit-note"
                      size={18}
                      color={ANN.blue}
                      style={styles.noteIcon}
                    />
                    <TextInput
                      style={styles.noteInput}
                      placeholder={`Add note (e.g. less spicy)`}
                      placeholderTextColor={THEME.textSecondary}
                      value={itemNotes[id] || ""}
                      onChangeText={(text) => handleItemNoteChange(id, text)}
                      maxLength={100}
                    />
                  </View>
                </View>
              );
            })}

            <View style={styles.divider} />

            <Text style={[styles.sectionHeader, { marginTop: 10 }]}>
              Order Instructions (Optional)
            </Text>
            <View
              style={[
                styles.noteInputContainer,
                { height: 80, alignItems: "flex-start", paddingTop: 10 },
              ]}
            >
              <MaterialIcons
                name="restaurant"
                size={18}
                color={ANN.blue}
                style={styles.noteIcon}
              />
              <TextInput
                style={[
                  styles.noteInput,
                  { height: 60, textAlignVertical: "top", paddingTop: 0 },
                ]}
                placeholder="Any general requests for the kitchen? (e.g. Extra plates, quick service)"
                placeholderTextColor={THEME.textSecondary}
                value={orderNote}
                onChangeText={setOrderNote}
                multiline
                maxLength={200}
              />
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <View style={styles.summaryBox}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Item Total</Text>
                <Text style={styles.totalValue}>
                  {currency}
                  {cartTotalPrice.toFixed(2)}
                </Text>
              </View>
              <Text style={styles.taxDisclaimerText}>
                *Taxes & fees calculated at checkout
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, placing && { opacity: 0.7 }]}
              onPress={handlePlaceOrder}
              disabled={placing}
            >
              {placing ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={22}
                    color="white"
                  />
                  <Text style={styles.primaryBtnText}>
                    Confirm & Place Order
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  // ── BACKGROUND STYLES ──
  mainWrapper: {
    flex: 1,
    backgroundColor: THEME.background,
  },
  bgImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
    resizeMode: "cover",
    opacity: 0.15, // Glass effect opacity
  },
  bgOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.85)", // Frosted overlay
  },
  container: {
    flex: 1,
    maxWidth: 480,
    width: "100%",
    alignSelf: "center",
    backgroundColor: "transparent",
  },
  header: {
    backgroundColor: "rgba(255, 255, 255, 0.6)",
    paddingTop: Platform.OS === "android" ? 40 : 16,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: { fontSize: 20, fontWeight: "900", color: ANN.darkBlue },
  clearCartBtn: {
    padding: 8,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderRadius: 8,
  },
  scrollContent: { padding: 20, paddingBottom: 180 },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: ANN.darkBlue,
  },
  itemCountText: {
    fontSize: 12,
    fontWeight: "bold",
    color: ANN.orange,
    backgroundColor: ANN.orangeLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(254, 154, 84, 0.3)",
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(42, 71, 149, 0.1)",
    marginVertical: 15,
  },

  // ── CART ITEM CARD (GLASS EFFECT) ──
  cartItemCard: {
    backgroundColor: "rgba(255, 255, 255, 0.75)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(42, 71, 149, 0.15)",
    ...Platform.select({
      web: { boxShadow: "0px 4px 12px rgba(0,0,0,0.03)" } as any,
      default: {
        shadowColor: THEME.textPrimary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 10,
        elevation: 2,
      },
    }),
  },
  itemTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  itemName: {
    fontSize: 16,
    fontWeight: "bold",
    color: ANN.darkBlue,
    marginBottom: 6,
  },
  itemPrice: { fontSize: 16, fontWeight: "900", color: ANN.red },
  controlsContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  deleteItemBtn: {
    padding: 6,
    backgroundColor: ANN.redLight,
    borderRadius: 8,
  },
  qtySelector: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 10,
    padding: 2,
    borderWidth: 1,
    borderColor: ANN.orange,
  },
  qtyBtn: {
    padding: 6,
    paddingHorizontal: 10,
    backgroundColor: ANN.orangeLight,
    borderRadius: 6,
  },
  qtyText: {
    marginHorizontal: 8,
    fontWeight: "900",
    fontSize: 16,
    color: ANN.darkBlue,
    minWidth: 18,
    textAlign: "center",
  },
  noteInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.6)",
    borderRadius: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(42, 71, 149, 0.2)",
  },
  noteIcon: {
    marginRight: 8,
  },
  noteInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    color: THEME.textPrimary,
  },

  // ── FOOTER ──
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(255,255,255,0.95)",
    padding: 20,
    paddingBottom: Platform.OS === "ios" ? 30 : 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: "rgba(42, 71, 149, 0.1)",
    ...Platform.select({
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -6 },
        shadowOpacity: 0.08,
        shadowRadius: 15,
        elevation: 15,
      },
    }),
  },
  summaryBox: {
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  totalLabel: { fontSize: 16, fontWeight: "bold", color: ANN.darkBlue },
  totalValue: { fontSize: 26, fontWeight: "900", color: ANN.red },
  taxDisclaimerText: {
    fontSize: 11,
    color: "#94A3B8",
    fontStyle: "italic",
  },
  primaryBtn: {
    backgroundColor: ANN.orange,
    padding: 18,
    borderRadius: 14,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    shadowColor: ANN.orange,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  primaryBtnText: {
    color: "white",
    fontWeight: "900",
    fontSize: 17,
    letterSpacing: 0.5,
  },

  // ── EMPTY STATE ──
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: ANN.orangeLight,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(254, 154, 84, 0.3)",
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: ANN.darkBlue,
    marginBottom: 10,
  },
  emptySub: {
    fontSize: 15,
    color: THEME.textSecondary,
    textAlign: "center",
    marginBottom: 35,
    lineHeight: 22,
  },
  browseBtn: {
    backgroundColor: ANN.orange,
    paddingHorizontal: 30,
    paddingVertical: 16,
    borderRadius: 14,
    shadowColor: ANN.orange,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  browseBtnText: { color: "#FFF", fontWeight: "bold", fontSize: 16 },
});
