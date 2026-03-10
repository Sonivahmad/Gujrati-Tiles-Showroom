import { useState, useEffect, useRef } from "react";

// ─── MOCK DATABASE (Replace with Firebase later) ───────────────────────────
// SaaS-ready: each record has shopId. For single shop, shopId = "shop_001"
// Later: shopId = Firebase Auth UID

const SHOP_ID = "shop_001"; // 🔴 SaaS switch: replace with auth.currentUser.uid

const initialInventory = [
  { id: "t1", shopId: SHOP_ID, name: "Italian Marble", size: "2x4", shade: "Shade A", purchaseRate: 72, sellingRate: 95, stock: 73, unit: "box" },
  { id: "t2", shopId: SHOP_ID, name: "Italian Marble", size: "2x2", shade: "Shade B", purchaseRate: 58, sellingRate: 78, stock: 40, unit: "box" },
  { id: "t3", shopId: SHOP_ID, name: "Italian White", size: "2x4", shade: "Shade C", purchaseRate: 80, sellingRate: 105, stock: 12, unit: "box" },
  { id: "t4", shopId: SHOP_ID, name: "Kajaria Matt", size: "2x2", shade: "Grey", purchaseRate: 45, sellingRate: 62, stock: 88, unit: "box" },
  { id: "t5", shopId: SHOP_ID, name: "Kajaria Glossy", size: "2x4", shade: "White", purchaseRate: 55, sellingRate: 75, stock: 6, unit: "box" },
  { id: "t6", shopId: SHOP_ID, name: "Somany Wood", size: "2x4", shade: "Walnut", purchaseRate: 90, sellingRate: 120, stock: 34, unit: "box" },
  { id: "t7", shopId: SHOP_ID, name: "Somany Wood", size: "2x2", shade: "Oak", purchaseRate: 82, sellingRate: 108, stock: 0, unit: "box" },
  { id: "t8", shopId: SHOP_ID, name: "Nitco Pearl", size: "2x4", shade: "Beige", purchaseRate: 68, sellingRate: 89, stock: 55, unit: "box" },
];

const initialSales = [
  { id: "s1", shopId: SHOP_ID, billNo: "TPS-000001", date: "2025-03-01", type: "Invoice", customerId: "c1", customerName: "Ramesh Sharma", items: [{ name: "Italian Marble 2x4 Shade A", qty: 10, rate: 95, total: 950 }], gross: 950, discount: 50, gst: 162, net: 1062, paid: 1062, pending: 0, paymentMethod: "UPI" },
  { id: "s2", shopId: SHOP_ID, billNo: "TPS-000002", date: "2025-03-03", type: "Invoice", customerId: "c2", customerName: "Contractor Suresh", items: [{ name: "Kajaria Matt 2x2 Grey", qty: 25, rate: 62, total: 1550 }], gross: 1550, discount: 0, gst: 279, net: 1829, paid: 1000, pending: 829, paymentMethod: "Cash" },
  { id: "s3", shopId: SHOP_ID, billNo: "TPS-000003", date: "2025-03-05", type: "Invoice", customerId: "c3", customerName: "Builder Anand", items: [{ name: "Somany Wood 2x4 Walnut", qty: 15, rate: 120, total: 1800 }, { name: "Italian White 2x4 Shade C", qty: 8, rate: 105, total: 840 }], gross: 2640, discount: 140, gst: 450.6, net: 2950, paid: 2950, pending: 0, paymentMethod: "Bank Transfer" },
];

const initialCustomers = [
  { id: "c1", shopId: SHOP_ID, name: "Ramesh Sharma", phone: "9876543210", address: "123 Main St", type: "Retail", totalSpent: 1062, totalPending: 0 },
  { id: "c2", shopId: SHOP_ID, name: "Contractor Suresh", phone: "8765432109", address: "Plot 44, Industrial Area", type: "Contractor", totalSpent: 1829, totalPending: 829 },
  { id: "c3", shopId: SHOP_ID, name: "Builder Anand", phone: "7654321098", address: "Skyline Towers Site", type: "Builder", totalSpent: 2950, totalPending: 0 },
];

const initialExpenses = [];
const initialPurchases = [];
const initialSuppliers = [
  { id: "sup1", shopId: SHOP_ID, name: "Kajaria Distributors", phone: "9876543210", totalBought: 14500, totalPending: 2500 },
  { id: "sup2", shopId: SHOP_ID, name: "Somany Hub", phone: "8765432109", totalBought: 8200, totalPending: 0 }
];

const TILES_PER_BOX = { "2x2": 16, "2x4": 8 }; // pieces per box
const SQ_FT_PER_BOX = { "2x2": 4, "2x4": 8 }; // approx sq.ft per box

// ─── ICONS ──────────────────────────────────────────────────────────────────
const Icon = ({ d, size = 20, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

// ─── MAIN APP ────────────────────────────────────────────────────────────────
export default function TilesApp() {
  const [tab, setTab] = useState("billing");

  const [inventory, setInventory] = useState(() => {
    const saved = localStorage.getItem("tiles_inventory");
    return saved ? JSON.parse(saved) : initialInventory;
  });

  const [sales, setSales] = useState(() => {
    const saved = localStorage.getItem("tiles_sales");
    return saved ? JSON.parse(saved) : initialSales;
  });

  const [customers, setCustomers] = useState(() => {
    const saved = localStorage.getItem("tiles_customers");
    return saved ? JSON.parse(saved) : initialCustomers;
  });

  const [expenses, setExpenses] = useState(() => {
    const saved = localStorage.getItem("tiles_expenses");
    return saved ? JSON.parse(saved) : initialExpenses;
  });

  const [purchases, setPurchases] = useState(() => {
    const saved = localStorage.getItem("tiles_purchases");
    return saved ? JSON.parse(saved) : initialPurchases;
  });

  const [suppliers, setSuppliers] = useState(() => {
    const saved = localStorage.getItem("tiles_suppliers");
    return saved ? JSON.parse(saved) : initialSuppliers;
  });

  const [toast, setToast] = useState(null);

  useEffect(() => { localStorage.setItem("tiles_inventory", JSON.stringify(inventory)); }, [inventory]);
  useEffect(() => { localStorage.setItem("tiles_sales", JSON.stringify(sales)); }, [sales]);
  useEffect(() => { localStorage.setItem("tiles_customers", JSON.stringify(customers)); }, [customers]);
  useEffect(() => { localStorage.setItem("tiles_expenses", JSON.stringify(expenses)); }, [expenses]);
  useEffect(() => { localStorage.setItem("tiles_purchases", JSON.stringify(purchases)); }, [purchases]);
  useEffect(() => { localStorage.setItem("tiles_suppliers", JSON.stringify(suppliers)); }, [suppliers]);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const addSale = (sale) => {
    const isEstimate = sale.type === "Estimate";

    // Deduct stock only if it's an Invoice
    if (!isEstimate) {
      const updated = inventory.map(tile => {
        const item = sale.items.find(i => i.tileId === tile.id);
        if (item) return { ...tile, stock: tile.stock - item.qty };
        return tile;
      });
      setInventory(updated);
    }

    // Update or Create Customer
    let customerId = sale.customerId;
    if (!customerId) {
      customerId = "c" + Date.now();
      const newCustomer = {
        id: customerId, shopId: SHOP_ID, name: sale.customerName, phone: sale.customerPhone,
        address: "", type: "Retail", totalSpent: isEstimate ? 0 : sale.net, totalPending: isEstimate ? 0 : sale.pending
      };
      setCustomers(prev => [...prev, newCustomer]);
    } else if (!isEstimate) {
      setCustomers(prev => prev.map(c => c.id === customerId ? {
        ...c, totalSpent: (c.totalSpent || 0) + sale.net, totalPending: (c.totalPending || 0) + sale.pending
      } : c));
    }

    const newSale = {
      ...sale,
      id: "s" + Date.now(),
      shopId: SHOP_ID,
      customerId,
      date: new Date().toISOString().split("T")[0]
    };

    setSales(prev => [newSale, ...prev]);
    showToast(isEstimate ? "📝 Estimate saved!" : "✅ Bill saved successfully!");
  };

  const processReturn = (returnData) => {
    // 1. Update Inventory
    const updatedInv = inventory.map(t => {
      const returnedItem = returnData.items.find(i => i.tileId === t.id || i.name === `${t.name} ${t.size} - ${t.shade}` || i.name === `${t.name} ${t.size} ${t.shade}`);
      if (returnedItem) return { ...t, stock: t.stock + returnedItem.qtyReturned };
      return t;
    });
    setInventory(updatedInv);

    // 2. Adjust Customer Ledger
    if (returnData.customerId) {
      setCustomers(prev => prev.map(c => {
        if (c.id === returnData.customerId) {
          let newPending = c.totalPending;
          let diff = returnData.totalRefund;
          if (newPending >= diff) {
            newPending -= diff;
          } else {
            newPending = 0;
          }
          return { ...c, totalSpent: Math.max(0, c.totalSpent - returnData.totalRefund), totalPending: newPending };
        }
        return c;
      }));
    }

    // 3. Save as Return Receipt
    const newReturn = {
      id: "r" + Date.now(),
      shopId: SHOP_ID,
      type: "Return",
      billNo: "RET-" + Date.now().toString().slice(-6),
      originalBillId: returnData.originalBillId,
      customerId: returnData.customerId,
      customerName: returnData.customerName,
      items: returnData.items.map(i => ({ ...i, qty: -i.qtyReturned, total: -i.refundAmount })),
      gross: -returnData.totalRefund,
      discount: 0,
      gst: 0,
      net: -returnData.totalRefund,
      paid: -returnData.totalRefund,
      pending: 0,
      paymentMethod: returnData.refundMethod || "Adjusted against due",
      date: new Date().toISOString().split("T")[0]
    };

    setSales(prev => [newReturn, ...prev]);
    showToast("✅ Return processed successfully!");
  };

  const addInventory = (item) => {
    const existing = inventory.find(t =>
      t.id === item.id ||
      (t.name.toLowerCase().trim() === item.name.toLowerCase().trim() &&
        t.shade.toLowerCase().trim() === item.shade.toLowerCase().trim() &&
        t.size === item.size)
    );
    if (existing) {
      setInventory(prev => prev.map(t =>
        t.id === existing.id
          ? { ...t, stock: t.stock + item.addStock, purchaseRate: item.purchaseRate, sellingRate: item.sellingRate }
          : t
      ));
    } else {
      setInventory(prev => [...prev, { ...item, shopId: SHOP_ID }]);
    }
    showToast("📦 Inventory updated!");
  };

  const deleteSale = (saleId) => {
    if (!window.confirm("Are you sure you want to delete this document?")) return;
    const sale = sales.find(s => s.id === saleId);
    if (!sale) return;

    if (sale.type === "Invoice") {
      // Restock inventory
      const updated = inventory.map(tile => {
        const item = sale.items.find(i => i.tileId === tile.id || i.name === `${tile.name} ${tile.size} ${tile.shade}`);
        if (item) return { ...tile, stock: tile.stock + item.qty };
        return tile;
      });
      setInventory(updated);

      // Revert customer balances
      if (sale.customerId) {
        setCustomers(prev => prev.map(c => c.id === sale.customerId ? {
          ...c, totalSpent: Math.max(0, c.totalSpent - sale.net), totalPending: Math.max(0, c.totalPending - sale.pending)
        } : c));
      }
    }

    setSales(prev => prev.filter(s => s.id !== saleId));
    showToast(`🗑️ ${sale.type} deleted successfully!`);
  };

  const deleteInventory = (id) => {
    if (!window.confirm("Are you sure you want to delete this tile from inventory?")) return;
    setInventory(prev => prev.filter(t => t.id !== id));
    showToast("🗑️ Tile deleted successfully!");
  };

  const tabs = [
    { id: "billing", label: "Billing / Est.", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
    { id: "inventory", label: "Stock", icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" },
    { id: "calculator", label: "Calculator", icon: "M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" },
    { id: "returns", label: "Returns", icon: "M16 15v-1a4 4 0 00-4-4H8m0 0l3 3m-3-3l3-3m9 14V5a2 2 0 00-2-2H6a2 2 0 00-2 2v16l4-2 4 2 4-2 4 2z" },
    { id: "customers", label: "Customers", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" },
    { id: "expenses", label: "Expenses", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
    { id: "purchases", label: "Purchases", icon: "M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" },
    { id: "reports", label: "Reports", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
  ];

  const lowStock = inventory.filter(t => t.shopId === SHOP_ID && t.stock <= 10 && t.stock > 0);
  const deadStock = inventory.filter(t => t.shopId === SHOP_ID && t.stock === 0);

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: "#0f1117", minHeight: "100vh", color: "#e8e8e8" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #1a1d2e 0%, #12151f 100%)", borderBottom: "1px solid #2a2d3e", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, background: "linear-gradient(135deg, #f59e0b, #ef4444)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🪨</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: "#fff", letterSpacing: "-0.3px" }}>Gujrati Tiles</div>
              <div style={{ fontSize: 11, color: "#6b7280" }}>Showroom Management</div>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {lowStock.length > 0 && (
            <div style={{ background: "#451a03", border: "1px solid #92400e", borderRadius: 20, padding: "4px 10px", fontSize: 11, color: "#fbbf24", display: "flex", alignItems: "center", gap: 4 }}>
              ⚠️ {lowStock.length} Low Stock
            </div>
          )}
          {deadStock.length > 0 && (
            <div style={{ background: "#1f1315", border: "1px solid #7f1d1d", borderRadius: 20, padding: "4px 10px", fontSize: 11, color: "#f87171", display: "flex", alignItems: "center", gap: 4 }}>
              🚫 {deadStock.length} Out of Stock
            </div>
          )}
        </div>
      </div>

      {/* Nav */}
      <div style={{ display: "flex", background: "#12151f", borderBottom: "1px solid #1e2130", padding: "0 16px" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "12px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer", border: "none",
            background: "transparent", color: tab === t.id ? "#f59e0b" : "#6b7280",
            borderBottom: tab === t.id ? "2px solid #f59e0b" : "2px solid transparent",
            display: "flex", alignItems: "center", gap: 6, transition: "all 0.2s", fontFamily: "'DM Sans', sans-serif"
          }}>
            <Icon d={t.icon} size={15} color={tab === t.id ? "#f59e0b" : "#6b7280"} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: 20, maxWidth: 1000, margin: "0 auto" }}>
        {tab === "billing" && <BillingTab inventory={inventory.filter(t => t.shopId === SHOP_ID)} customers={customers.filter(c => c.shopId === SHOP_ID)} onSave={addSale} />}
        {tab === "inventory" && <InventoryTab inventory={inventory.filter(t => t.shopId === SHOP_ID)} onAdd={addInventory} onDelete={deleteInventory} />}
        {tab === "calculator" && <CalculatorTab inventory={inventory.filter(t => t.shopId === SHOP_ID)} />}
        {tab === "returns" && <ReturnsTab sales={sales.filter(s => s.shopId === SHOP_ID)} onProcessReturn={processReturn} />}
        {tab === "customers" && <CustomersTab customers={customers.filter(c => c.shopId === SHOP_ID)} sales={sales.filter(s => s.shopId === SHOP_ID)} onUpdateCustomer={(cus) => setCustomers(prev => prev.map(c => c.id === cus.id ? cus : c))} />}
        {tab === "expenses" && <ExpensesTab expenses={expenses.filter(e => e.shopId === SHOP_ID)} onAdd={(e) => { setExpenses(prev => [{ ...e, id: "e" + Date.now(), shopId: SHOP_ID }, ...prev]); showToast("💸 Expense recorded"); }} onDelete={(id) => { setExpenses(prev => prev.filter(e => e.id !== id)); showToast("🗑️ Expense deleted"); }} />}
        {tab === "purchases" && <PurchasesTab purchases={purchases.filter(p => p.shopId === SHOP_ID)} suppliers={suppliers.filter(s => s.shopId === SHOP_ID)} inventory={inventory.filter(t => t.shopId === SHOP_ID)} onUpdateSupplier={(sup) => setSuppliers(prev => prev.map(s => s.id === sup.id ? sup : s))} onAddPurchase={(p) => {
          const updatedInv = inventory.map(t => {
            const item = p.items.find(i => i.tileId === t.id);
            if (item) return { ...t, stock: t.stock + item.qty };
            return t;
          });
          setInventory(updatedInv);
          let supId = p.supplierId;
          if (!supId) {
            supId = "sup" + Date.now();
            setSuppliers(prev => [...prev, { id: supId, shopId: SHOP_ID, name: p.supplierName, phone: p.supplierPhone, totalBought: p.net, totalPending: p.pending }]);
          } else {
            setSuppliers(prev => prev.map(s => s.id === supId ? { ...s, totalBought: s.totalBought + p.net, totalPending: s.totalPending + p.pending } : s));
          }
          setPurchases(prev => [{ ...p, id: "p" + Date.now(), shopId: SHOP_ID, supplierId: supId }, ...prev]);
          showToast("📦 Purchase recorded!");
        }} />}
        {tab === "reports" && <ReportsTab sales={sales.filter(s => s.shopId === SHOP_ID)} inventory={inventory.filter(t => t.shopId === SHOP_ID)} expenses={expenses.filter(e => e.shopId === SHOP_ID)} onDelete={deleteSale} />}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          background: toast.type === "error" ? "#7f1d1d" : "#064e3b",
          border: `1px solid ${toast.type === "error" ? "#ef4444" : "#10b981"}`,
          color: "#fff", padding: "12px 20px", borderRadius: 10, fontSize: 14, fontWeight: 500,
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)", zIndex: 999, whiteSpace: "nowrap"
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ─── BILLING TAB ─────────────────────────────────────────────────────────────
function BillingTab({ inventory, customers, onSave }) {
  const [docType, setDocType] = useState("Invoice"); // Invoice or Estimate

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);

  const [search, setSearch] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [customerSuggestions, setCustomerSuggestions] = useState([]);

  const [cart, setCart] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [gstEnabled, setGstEnabled] = useState(true);

  const [amountPaid, setAmountPaid] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");

  const [qty, setQty] = useState(1);
  const [selectedTile, setSelectedTile] = useState(null);
  const [billDone, setBillDone] = useState(null);
  const searchRef = useRef();

  useEffect(() => {
    if (customerName.length < 2) { setCustomerSuggestions([]); return; }
    // Avoid showing suggestions if we just selected one
    if (customers.find(c => c.name === customerName && c.id === selectedCustomerId)) return;

    const q = customerName.toLowerCase();
    const results = customers.filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q));
    setCustomerSuggestions(results);
  }, [customerName, customers, selectedCustomerId]);

  useEffect(() => {
    if (search.length < 1) { setSuggestions([]); return; }
    const q = search.toLowerCase();
    const results = inventory.filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.shade.toLowerCase().includes(q) ||
      t.size.toLowerCase().includes(q)
    );
    setSuggestions(results);
  }, [search, inventory]);

  const selectTile = (tile) => {
    setSelectedTile(tile);
    setSearch(`${tile.name} ${tile.size} ${tile.shade}`);
    setSuggestions([]);
    setQty(1);
  };

  const addToCart = () => {
    if (!selectedTile) return;
    const inCart = cart.find(c => c.tileId === selectedTile.id);
    const totalQty = (inCart ? inCart.qty : 0) + qty;
    if (totalQty > selectedTile.stock) {
      alert(`⚠️ Only ${selectedTile.stock} boxes available in stock!`); return;
    }
    if (inCart) {
      setCart(cart.map(c => c.tileId === selectedTile.id ? { ...c, qty: c.qty + qty, total: (c.qty + qty) * c.rate } : c));
    } else {
      setCart([...cart, {
        tileId: selectedTile.id, name: `${selectedTile.name} ${selectedTile.size} ${selectedTile.shade}`,
        qty, rate: selectedTile.sellingRate, total: qty * selectedTile.sellingRate
      }]);
    }
    setSearch(""); setSelectedTile(null); setQty(1);
  };

  const gross = cart.reduce((s, c) => s + c.total, 0);
  const afterDiscount = gross - (Number(discount) || 0);
  const gstAmt = gstEnabled ? afterDiscount * 0.18 : 0;
  const net = afterDiscount + gstAmt;

  useEffect(() => {
    // If it's an estimate, or if user hasn't explicitly typed an amount, default amountPaid to net (full payment)
    if (docType === "Estimate") setAmountPaid("0");
    else if (amountPaid === "" || Number(amountPaid) > net) setAmountPaid(net.toFixed(2));
  }, [net, docType]);

  const handleSave = () => {
    if (!customerName || cart.length === 0) { alert("Customer name & items required!"); return; }

    let paid = docType === "Estimate" ? 0 : Number(amountPaid);
    if (isNaN(paid)) paid = 0;

    // Safety check - can't pay more than net
    if (paid > net) {
      alert("Amount paid cannot be more than the net total.");
      return;
    }

    const pending = net - paid;
    const billNo = (docType === "Estimate" ? "EST-" : "TPS-") + Date.now().toString().slice(-6);

    const sale = {
      type: docType,
      billNo,
      customerId: selectedCustomerId,
      customerName,
      customerPhone,
      items: cart,
      gross,
      discount: (Number(discount) || 0),
      gst: gstAmt,
      net,
      paid,
      pending,
      paymentMethod
    };

    onSave(sale);
    setBillDone({ ...sale, date: new Date().toLocaleDateString("en-IN") });

    // Reset Form
    setCustomerName(""); setCustomerPhone(""); setSelectedCustomerId(null);
    setCart([]); setDiscount(0); setSearch(""); setAmountPaid("");
  };

  if (billDone) return <BillPreview bill={billDone} onNew={() => setBillDone(null)} />;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 24, alignItems: "start" }}>
      {/* LEFT COLUMN: Main Form */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#fff", marginBottom: 4 }}>Create Document</div>
            <div style={{ fontSize: 13, color: "#6b7280" }}>Add items to bill or estimate</div>
          </div>

          {/* Toggle Invoice vs Estimate */}
          <div style={{ display: "flex", background: "#1a1d2e", padding: 4, borderRadius: 8, border: "1px solid #2a2d3e" }}>
            <button onClick={() => setDocType("Invoice")} style={{ ...btnStyle, background: docType === "Invoice" ? "#10b981" : "transparent", color: docType === "Invoice" ? "#000" : "#9ca3af", fontWeight: docType === "Invoice" ? 700 : 500, padding: "6px 16px", borderRadius: 6 }}>Invoice</button>
            <button onClick={() => setDocType("Estimate")} style={{ ...btnStyle, background: docType === "Estimate" ? "#f59e0b" : "transparent", color: docType === "Estimate" ? "#000" : "#9ca3af", fontWeight: docType === "Estimate" ? 700 : 500, padding: "6px 16px", borderRadius: 6 }}>Estimate</button>
          </div>
        </div>

        {/* Smart Search */}
        <div style={{ marginBottom: 24, position: "relative" }}>
          <label style={labelStyle}>Search Inventory</label>
          <div style={{ position: "relative" }}>
            <div style={{ position: "absolute", left: 14, top: 12, color: "#9ca3af" }}>🔍</div>
            <input ref={searchRef} value={search} onChange={e => { setSearch(e.target.value); setSelectedTile(null); }}
              placeholder="Type tile name, shade, or size..."
              style={{ ...inputStyle, paddingLeft: 40, paddingRight: 40, fontSize: 16, padding: "14px 14px 14px 44px" }} />
            {search && <div style={{ position: "absolute", right: 14, top: 12, fontSize: 18, cursor: "pointer", color: "#6b7280" }} onClick={() => { setSearch(""); setSuggestions([]); setSelectedTile(null); }}>×</div>}
          </div>

          {/* Suggestions Dropdown */}
          {suggestions.length > 0 && (
            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#1a1d2e", border: "1px solid #2a2d3e", borderRadius: 10, zIndex: 50, overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
              {suggestions.map(tile => (
                <div key={tile.id} onClick={() => selectTile(tile)}
                  style={{ padding: "12px 16px", cursor: "pointer", borderBottom: "1px solid #1e2130", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#252837"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <div>
                    <div style={{ fontWeight: 600, color: "#fff", fontSize: 14 }}>{tile.name} <span style={{ color: "#9ca3af", fontWeight: 400 }}>{tile.size} — {tile.shade}</span></div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>MRP: ₹{tile.sellingRate}/box</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#10b981" }}>₹{tile.sellingRate}</div>
                    <div style={{
                      fontSize: 11, marginTop: 2, padding: "2px 8px", borderRadius: 20,
                      background: tile.stock === 0 ? "#7f1d1d" : tile.stock <= 10 ? "#451a03" : "#064e3b",
                      color: tile.stock === 0 ? "#f87171" : tile.stock <= 10 ? "#fbbf24" : "#6ee7b7"
                    }}>
                      {tile.stock === 0 ? "Out of Stock" : `${tile.stock} boxes`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected Tile + Qty */}
        {selectedTile && (
          <div style={{ background: "#1a1d2e", border: "1px solid #2a2d3e", borderRadius: 10, padding: 16, marginBottom: 16, display: "flex", gap: 12, alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 4 }}>Selected</div>
              <div style={{ fontWeight: 600, color: "#fff" }}>{selectedTile.name} {selectedTile.size} — {selectedTile.shade}</div>
              <div style={{ fontSize: 12, color: "#10b981", marginTop: 2 }}>₹{selectedTile.sellingRate}/box · {selectedTile.stock} boxes available</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={() => setQty(Math.max(1, qty - 1))} style={qtyBtnStyle}>−</button>
              <span style={{ minWidth: 32, textAlign: "center", fontWeight: 700, color: "#fff", fontSize: 16, fontFamily: "'DM Mono', monospace" }}>{qty}</span>
              <button onClick={() => setQty(Math.min(selectedTile.stock, qty + 1))} style={qtyBtnStyle}>+</button>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12, color: "#6b7280" }}>Total</div>
              <div style={{ fontWeight: 700, color: "#f59e0b", fontSize: 18, fontFamily: "'DM Mono', monospace" }}>₹{(qty * selectedTile.sellingRate).toLocaleString("en-IN")}</div>
            </div>
            <button onClick={addToCart} style={{ ...btnStyle, background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#000", fontWeight: 700 }}>
              + Add
            </button>
          </div>
        )}

        {/* Cart */}
        {cart.length > 0 && (
          <div style={{ background: "#12151f", border: "1px solid #1e2130", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
            <div style={{ padding: "10px 16px", background: "#1a1d2e", fontSize: 12, color: "#6b7280", display: "flex", justifyContent: "space-between" }}>
              <span>ITEM</span><span>QTY × RATE</span><span>TOTAL</span><span></span>
            </div>
            {cart.map((item, i) => (
              <div key={i} style={{ padding: "12px 16px", borderBottom: "1px solid #1e2130", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ flex: 1, fontSize: 14, color: "#e8e8e8", fontWeight: 500 }}>{item.name}</div>
                <div style={{ fontSize: 13, color: "#9ca3af", fontFamily: "'DM Mono', monospace", marginRight: 24 }}>{item.qty} × ₹{item.rate}</div>
                <div style={{ fontWeight: 700, color: "#fff", fontFamily: "'DM Mono', monospace", marginRight: 16 }}>₹{item.total.toLocaleString("en-IN")}</div>
                <button onClick={() => setCart(cart.filter((_, j) => j !== i))} style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 16 }}>×</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* RIGHT COLUMN: Customer & Payment Details */}
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Customer Details block */}
        <div style={{ background: "#1a1d2e", border: "1px solid #2a2d3e", borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#fff", marginBottom: 16 }}>Customer Details</div>

          <div style={{ position: "relative", marginBottom: 12 }}>
            <label style={labelStyle}>Customer Name *</label>
            <input value={customerName} onChange={e => { setCustomerName(e.target.value); setSelectedCustomerId(null); }} placeholder="e.g. Ramesh Sharma" style={inputStyle} />

            {customerSuggestions.length > 0 && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#252837", border: "1px solid #374151", borderRadius: 8, zIndex: 60, marginTop: 4, overflow: "hidden" }}>
                {customerSuggestions.map(cus => (
                  <div key={cus.id} onClick={() => { setCustomerName(cus.name); setCustomerPhone(cus.phone); setSelectedCustomerId(cus.id); setCustomerSuggestions([]); }}
                    style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid #374151" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#374151"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <div style={{ color: "#fff", fontSize: 14 }}>{cus.name}</div>
                    <div style={{ color: "#9ca3af", fontSize: 12 }}>{cus.phone}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label style={labelStyle}>Phone Number</label>
            <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="e.g. 9876543210" style={inputStyle} />
          </div>
        </div>

        {/* Payment Summary */}
        <div style={{ background: "#12151f", border: "1px solid #1e2130", borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#fff", marginBottom: 16 }}>Billing Summary</div>

          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: "#9ca3af" }}>Gross Amount</span>
            <span style={{ fontFamily: "'DM Mono', monospace", color: "#fff" }}>₹{gross.toLocaleString("en-IN")}</span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: "#9ca3af" }}>Discount</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "#9ca3af" }}>₹</span>
              <input type="number" value={discount} onChange={e => setDiscount(e.target.value)} min={0} max={gross}
                style={{ width: 80, background: "#1a1d2e", border: "1px solid #2a2d3e", borderRadius: 6, padding: "4px 8px", color: "#f87171", fontFamily: "'DM Mono', monospace", textAlign: "right", fontSize: 13 }} />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <label style={{ fontSize: 13, color: "#9ca3af", display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
              <input type="checkbox" checked={gstEnabled} onChange={e => setGstEnabled(e.target.checked)} style={{ accentColor: "#f59e0b" }} />
              GST (18%)
            </label>
            <span style={{ fontFamily: "'DM Mono', monospace", color: gstEnabled ? "#fbbf24" : "#4b5563" }}>₹{gstAmt.toFixed(2)}</span>
          </div>

          <div style={{ borderTop: "1px solid #2a2d3e", paddingTop: 16, marginBottom: docType === "Estimate" ? 0 : 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 700, fontSize: 16, color: "#fff" }}>Net Payable</span>
              <span style={{ fontWeight: 700, fontSize: 22, color: "#10b981", fontFamily: "'DM Mono', monospace" }}>₹{net.toFixed(2)}</span>
            </div>
          </div>

          {docType === "Invoice" && (
            <>
              <div style={{ background: "#1a1d2e", padding: 12, borderRadius: 8, border: "1px solid #2a2d3e", marginBottom: 16 }}>
                <label style={{ ...labelStyle, color: "#fbbf24", marginBottom: 8 }}>Amount Paid Now (₹)</label>
                <input type="number" value={amountPaid} onChange={e => setAmountPaid(e.target.value)} max={net} style={{ ...inputStyle, fontSize: 18, fontWeight: 700, color: "#f59e0b", textAlign: "right", padding: "12px 14px", border: "1px solid #451a03", background: "#2d1606" }} />

                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 13 }}>
                  <span style={{ color: "#9ca3af" }}>Pending Balance:</span>
                  <span style={{ color: "#f87171", fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>₹{(net - (Number(amountPaid) || 0)).toFixed(2)}</span>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Payment Method</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {["Cash", "UPI", "Bank Transfer", "Credit Card"].map(m => (
                    <div key={m} onClick={() => setPaymentMethod(m)} style={{
                      padding: "8px", textAlign: "center", borderRadius: 6, fontSize: 12, cursor: "pointer", border: "1px solid",
                      background: paymentMethod === m ? "#10b98122" : "#1a1d2e",
                      borderColor: paymentMethod === m ? "#10b981" : "#2a2d3e",
                      color: paymentMethod === m ? "#10b981" : "#9ca3af"
                    }}>
                      {m}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <button onClick={handleSave} style={{ ...btnStyle, width: "100%", background: "linear-gradient(135deg, #10b981, #059669)", color: "#fff", fontWeight: 700, fontSize: 15, padding: "14px" }}>
            {docType === "Estimate" ? "📄 Provide Estimate" : "💾 Save Invoice"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── BILL PREVIEW ─────────────────────────────────────────────────────────────
function BillPreview({ bill, onNew }) {
  return (
    <div>
      <div style={{ background: "#0d1f17", border: "1px solid #166534", borderRadius: 16, padding: 28, maxWidth: 500, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#fff" }}>Bill Generated!</div>
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>Bill No: <span style={{ color: "#f59e0b", fontFamily: "'DM Mono', monospace" }}>{bill.billNo}</span></div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>{bill.date}</div>
        </div>

        <div style={{ background: "#12151f", borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 8 }}>Customer: <span style={{ color: "#fff", fontWeight: 600 }}>{bill.customer}</span></div>
          {bill.items.map((item, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#e8e8e8", padding: "6px 0", borderBottom: "1px solid #1e2130" }}>
              <span>{item.name}</span>
              <span style={{ fontFamily: "'DM Mono', monospace" }}>{item.qty} box × ₹{item.rate} = ₹{item.total}</span>
            </div>
          ))}
          <div style={{ marginTop: 12, fontSize: 13, color: "#9ca3af" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>Gross</span><span style={{ fontFamily: "'DM Mono', monospace" }}>₹{bill.gross}</span></div>
            {bill.discount > 0 && <div style={{ display: "flex", justifyContent: "space-between", color: "#f87171" }}><span>Discount</span><span style={{ fontFamily: "'DM Mono', monospace" }}>-₹{bill.discount}</span></div>}
            {bill.gst > 0 && <div style={{ display: "flex", justifyContent: "space-between", color: "#fbbf24" }}><span>GST (18%)</span><span style={{ fontFamily: "'DM Mono', monospace" }}>₹{bill.gst.toFixed(2)}</span></div>}
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 18, color: "#10b981", marginTop: 8, borderTop: "1px solid #1e2130", paddingTop: 8 }}>
              <span>Net Total</span><span style={{ fontFamily: "'DM Mono', monospace" }}>₹{bill.net.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button style={{ ...btnStyle, flex: 1, background: "#1a1d2e", border: "1px solid #2a2d3e", color: "#9ca3af", fontSize: 13 }}>
            📱 WhatsApp
          </button>
          <button style={{ ...btnStyle, flex: 1, background: "#1a1d2e", border: "1px solid #2a2d3e", color: "#9ca3af", fontSize: 13 }}>
            🖨️ Print
          </button>
          <button onClick={onNew} style={{ ...btnStyle, flex: 1, background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#000", fontWeight: 700, fontSize: 13 }}>
            + New Bill
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── INVENTORY TAB ───────────────────────────────────────────────────────────
function InventoryTab({ inventory, onAdd, onDelete }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ id: "", name: "", size: "2x4", shade: "", purchaseRate: "", sellingRate: "", addStock: "" });
  const [filter, setFilter] = useState("");

  const filtered = inventory.filter(t =>
    t.name.toLowerCase().includes(filter.toLowerCase()) ||
    t.shade.toLowerCase().includes(filter.toLowerCase())
  );

  const handleSubmit = () => {
    if (!form.name || !form.purchaseRate || !form.sellingRate || !form.addStock) { alert("Fill all fields!"); return; }
    const id = form.id || `t${Date.now()}`;
    onAdd({ ...form, id, purchaseRate: Number(form.purchaseRate), sellingRate: Number(form.sellingRate), addStock: Number(form.addStock), stock: Number(form.addStock), unit: "box" });
    setForm({ id: "", name: "", size: "2x4", shade: "", purchaseRate: "", sellingRate: "", addStock: "" });
    setShowForm(false);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#fff" }}>Stock Inventory</div>
          <div style={{ fontSize: 13, color: "#6b7280" }}>{inventory.length} designs · {inventory.reduce((s, t) => s + t.stock, 0)} boxes total</div>
        </div>
        <button onClick={() => setShowForm(!showForm)} style={{ ...btnStyle, background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#000", fontWeight: 700 }}>
          + Add Stock
        </button>
      </div>

      {/* Add Form */}
      {showForm && (
        <div style={{ background: "#1a1d2e", border: "1px solid #2a2d3e", borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#fff", marginBottom: 16 }}>Add / Restock Tile</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Tile Name *</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Italian Marble" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Shade / Batch *</label>
              <input value={form.shade} onChange={e => setForm({ ...form, shade: e.target.value })} placeholder="e.g. Shade A / Lot 24" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Size</label>
              <select value={form.size} onChange={e => setForm({ ...form, size: e.target.value })} style={inputStyle}>
                <option>2x2</option><option>2x4</option><option>1x1</option><option>2x3</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Boxes to Add *</label>
              <input type="number" value={form.addStock} onChange={e => setForm({ ...form, addStock: e.target.value })} placeholder="e.g. 100" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Purchase Rate (₹/box) *</label>
              <input type="number" value={form.purchaseRate} onChange={e => setForm({ ...form, purchaseRate: e.target.value })} placeholder="e.g. 70" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Selling Rate (₹/box) *</label>
              <input type="number" value={form.sellingRate} onChange={e => setForm({ ...form, sellingRate: e.target.value })} placeholder="e.g. 95" style={inputStyle} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button onClick={handleSubmit} style={{ ...btnStyle, background: "linear-gradient(135deg, #10b981, #059669)", color: "#fff", fontWeight: 700 }}>Save</button>
            <button onClick={() => setShowForm(false)} style={{ ...btnStyle, background: "#12151f", border: "1px solid #2a2d3e", color: "#9ca3af" }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Filter */}
      <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search inventory..." style={{ ...inputStyle, marginBottom: 16 }} />

      {/* Stock Table */}
      <div style={{ background: "#12151f", border: "1px solid #1e2130", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr 0.5fr", padding: "10px 16px", background: "#1a1d2e", fontSize: 11, color: "#6b7280", fontWeight: 600, letterSpacing: "0.5px" }}>
          <span>TILE</span><span>SIZE</span><span>SHADE</span><span>PURCHASE</span><span>SELLING</span><span>STOCK</span><span></span>
        </div>
        {filtered.map((tile, i) => (
          <div key={tile.id} style={{
            display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr 0.5fr",
            padding: "12px 16px", borderBottom: "1px solid #1e2130",
            background: i % 2 === 0 ? "transparent" : "#0a0c14",
            alignItems: "center"
          }}>
            <span style={{ fontWeight: 600, color: "#e8e8e8", fontSize: 14 }}>{tile.name}</span>
            <span style={{ color: "#9ca3af", fontSize: 13 }}>{tile.size}</span>
            <span style={{ color: "#9ca3af", fontSize: 13 }}>{tile.shade}</span>
            <span style={{ fontFamily: "'DM Mono', monospace", color: "#9ca3af", fontSize: 13 }}>₹{tile.purchaseRate}</span>
            <span style={{ fontFamily: "'DM Mono', monospace", color: "#10b981", fontSize: 13, fontWeight: 600 }}>₹{tile.sellingRate}</span>
            <span style={{
              fontSize: 12, fontWeight: 700, fontFamily: "'DM Mono', monospace",
              color: tile.stock === 0 ? "#f87171" : tile.stock <= 10 ? "#fbbf24" : "#6ee7b7"
            }}>
              {tile.stock === 0 ? "OUT" : `${tile.stock} box`}
              {tile.stock > 0 && tile.stock <= 10 && <span style={{ marginLeft: 4, fontSize: 10 }}>⚠️</span>}
            </span>
            <button onClick={() => onDelete(tile.id)} style={{ background: "transparent", border: "none", color: "#f87171", cursor: "pointer", fontSize: 14, textAlign: "right", display: "flex", justifyContent: "flex-end", alignItems: "center" }} title="Delete Tile">
              🗑️
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── CALCULATOR TAB ──────────────────────────────────────────────────────────
function CalculatorTab({ inventory }) {
  const [area, setArea] = useState("");
  const [wastage, setWastage] = useState(10);
  const [selectedSize, setSelectedSize] = useState("2x4");
  const [result, setResult] = useState(null);

  const calculate = () => {
    if (!area) return;
    const sqft = Number(area);
    const withWastage = sqft * (1 + wastage / 100);
    const boxesNeeded = Math.ceil(withWastage / SQ_FT_PER_BOX[selectedSize]);
    const available = inventory.filter(t => t.size === selectedSize && t.stock > 0);
    setResult({ sqft, withWastage, boxesNeeded, available });
  };

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#fff", marginBottom: 4 }}>Area Calculator</div>
        <div style={{ fontSize: 13, color: "#6b7280" }}>Customer ka area daalo — kitne box chahiye sab calculate hoga</div>
      </div>

      <div style={{ background: "#1a1d2e", border: "1px solid #2a2d3e", borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
          <div>
            <label style={labelStyle}>Room Area (sq.ft)</label>
            <input type="number" value={area} onChange={e => setArea(e.target.value)} placeholder="e.g. 450" style={{ ...inputStyle, fontSize: 18, fontWeight: 700, color: "#f59e0b" }} />
          </div>
          <div>
            <label style={labelStyle}>Tile Size</label>
            <select value={selectedSize} onChange={e => setSelectedSize(e.target.value)} style={inputStyle}>
              <option value="2x2">2×2</option>
              <option value="2x4">2×4</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Wastage % (cuts + breakage)</label>
            <input type="number" value={wastage} onChange={e => setWastage(e.target.value)} min={0} max={30} style={inputStyle} />
          </div>
        </div>
        <button onClick={calculate} style={{ ...btnStyle, background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#000", fontWeight: 700, fontSize: 15, width: "100%", padding: "13px" }}>
          📐 Calculate
        </button>
      </div>

      {result && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
            {[
              { label: "Base Area", value: `${result.sqft} sq.ft`, color: "#9ca3af" },
              { label: `+${wastage}% Wastage`, value: `${result.withWastage.toFixed(1)} sq.ft`, color: "#fbbf24" },
              { label: "Boxes Required", value: `${result.boxesNeeded} boxes`, color: "#10b981" },
            ].map((s, i) => (
              <div key={i} style={{ background: "#12151f", border: "1px solid #1e2130", borderRadius: 10, padding: 16, textAlign: "center" }}>
                <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: s.color, fontFamily: "'DM Mono', monospace" }}>{s.value}</div>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 15, fontWeight: 600, color: "#fff", marginBottom: 12 }}>Available {selectedSize} Tiles in Stock</div>
          {result.available.map(tile => {
            const enough = tile.stock >= result.boxesNeeded;
            return (
              <div key={tile.id} style={{ background: "#12151f", border: `1px solid ${enough ? "#166534" : "#7f1d1d"}`, borderRadius: 10, padding: 14, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 600, color: "#fff" }}>{tile.name} — {tile.shade}</div>
                  <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>₹{tile.sellingRate}/box · Est. total: ₹{(result.boxesNeeded * tile.sellingRate).toLocaleString("en-IN")}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 700, color: enough ? "#10b981" : "#f87171", fontFamily: "'DM Mono', monospace" }}>{tile.stock} box</div>
                  <div style={{ fontSize: 11, color: enough ? "#6ee7b7" : "#f87171", marginTop: 2 }}>{enough ? "✅ Enough stock" : `⚠️ Short by ${result.boxesNeeded - tile.stock} boxes`}</div>
                </div>
              </div>
            );
          })}
          {result.available.length === 0 && <div style={{ color: "#f87171", padding: 16 }}>No {selectedSize} tiles in stock.</div>}
        </div>
      )}
    </div>
  );
}

// ─── CUSTOMERS & CRM TAB ─────────────────────────────────────────────────────
function CustomersTab({ customers, sales, onUpdateCustomer }) {
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
  const customerSales = selectedCustomer ? sales.filter(s => s.customerId === selectedCustomer.id && s.type === "Invoice") : [];

  const handlePayBalance = () => {
    const amt = prompt(`Enter amount paid by ${selectedCustomer.name} towards pending balance of ₹${selectedCustomer.totalPending}:`);
    if (!amt || isNaN(amt)) return;

    const paid = Number(amt);
    if (paid <= 0 || paid > selectedCustomer.totalPending) {
      alert("Invalid amount."); return;
    }

    // In a real app we'd create a "Payment Receipt" record
    onUpdateCustomer({ ...selectedCustomer, totalPending: selectedCustomer.totalPending - paid });
    alert("Payment recorded successfully!");
  };

  if (selectedCustomer) {
    return (
      <div>
        <button onClick={() => setSelectedCustomerId(null)} style={{ ...btnStyle, background: "transparent", color: "#6b7280", padding: 0, marginBottom: 20 }}>
          ← Back to Directory
        </button>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 24, alignItems: "start" }}>
          <div style={{ background: "#1a1d2e", border: "1px solid #2a2d3e", borderRadius: 12, padding: 24 }}>
            <div style={{ width: 64, height: 64, background: "linear-gradient(135deg, #f59e0b, #d97706)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: "#fff", fontWeight: 700, marginBottom: 16 }}>
              {selectedCustomer.name.charAt(0)}
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#fff", marginBottom: 4 }}>{selectedCustomer.name}</div>
            <div style={{ fontSize: 14, color: "#9ca3af", marginBottom: 16 }}>{selectedCustomer.phone}</div>

            <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
              <span style={{ padding: "4px 10px", background: "#1e3a8a", color: "#93c5fd", borderRadius: 20, fontSize: 12 }}>{selectedCustomer.type}</span>
            </div>

            <div style={{ borderTop: "1px solid #2a2d3e", paddingTop: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Lifetime Value</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#10b981", fontFamily: "'DM Mono', monospace" }}>₹{selectedCustomer.totalSpent.toLocaleString("en-IN")}</div>
            </div>

            <div style={{ background: selectedCustomer.totalPending > 0 ? "#451a03" : "#12151f", border: `1px solid ${selectedCustomer.totalPending > 0 ? "#92400e" : "#2a2d3e"}`, borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 12, color: selectedCustomer.totalPending > 0 ? "#fcd34d" : "#6b7280", marginBottom: 4 }}>Pending Due</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: selectedCustomer.totalPending > 0 ? "#fbbf24" : "#e8e8e8", fontFamily: "'DM Mono', monospace" }}>₹{selectedCustomer.totalPending.toLocaleString("en-IN")}</div>

              {selectedCustomer.totalPending > 0 && (
                <button onClick={handlePayBalance} style={{ ...btnStyle, width: "100%", background: "#f59e0b", color: "#000", fontWeight: 700, marginTop: 12, padding: "8px" }}>
                  💰 Receive Payment
                </button>
              )}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 16 }}>Purchase History ({customerSales.length})</div>
            {customerSales.length === 0 ? <div style={{ color: "#6b7280" }}>No purchases yet.</div> : (
              customerSales.map(bill => (
                <div key={bill.id} style={{ background: "#12151f", border: "1px solid #1e2130", borderRadius: 10, padding: 16, marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <div>
                      <span style={{ color: "#f59e0b", fontFamily: "'DM Mono', monospace", fontWeight: 600, marginRight: 12 }}>{bill.billNo}</span>
                      <span style={{ color: "#9ca3af", fontSize: 12 }}>{bill.date}</span>
                    </div>
                    <div style={{ fontWeight: 700, color: "#10b981", fontFamily: "'DM Mono', monospace", fontSize: 16 }}>₹{bill.net.toFixed(2)}</div>
                  </div>
                  <div style={{ fontSize: 13, color: "#6b7280" }}>
                    {bill.items.map((i, idx) => <span key={idx}>{i.name} ({i.qty}){idx < bill.items.length - 1 ? ', ' : ''}</span>)}
                  </div>
                  {bill.pending > 0 && (
                    <div style={{ marginTop: 8, fontSize: 12, color: "#f87171", fontFamily: "'DM Mono', monospace" }}>
                      ⚠️ Unpaid: ₹{bill.pending.toFixed(2)}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#fff", marginBottom: 4 }}>Customer Directory Dashboard</div>
          <div style={{ fontSize: 13, color: "#6b7280" }}>{customers.length} total customers · ₹{customers.reduce((s, c) => s + c.totalPending, 0).toLocaleString("en-IN")} pending in market</div>
        </div>
      </div>

      <div style={{ background: "#12151f", border: "1px solid #1e2130", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1fr 1fr", padding: "12px 20px", background: "#1a1d2e", fontSize: 11, color: "#6b7280", fontWeight: 600, letterSpacing: "0.5px" }}>
          <span>CUSTOMER</span><span>PHONE</span><span>TYPE</span><span>LIFETIME SPENT</span><span>PENDING DUE</span>
        </div>
        {customers.map((c, i) => (
          <div key={c.id} onClick={() => setSelectedCustomerId(c.id)} style={{
            display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1fr 1fr",
            padding: "16px 20px", borderBottom: "1px solid #1e2130",
            background: i % 2 === 0 ? "transparent" : "#0a0c14",
            alignItems: "center", cursor: "pointer", transition: "background 0.2s"
          }} onMouseEnter={e => e.currentTarget.style.background = "#1a1d2e"} onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "transparent" : "#0a0c14"}>
            <div style={{ fontWeight: 600, color: "#fff", fontSize: 14 }}>{c.name}</div>
            <div style={{ color: "#9ca3af", fontSize: 13 }}>{c.phone}</div>
            <div><span style={{ padding: "4px 8px", background: "#1e3a8a", color: "#93c5fd", borderRadius: 20, fontSize: 11 }}>{c.type}</span></div>
            <div style={{ fontFamily: "'DM Mono', monospace", color: "#10b981", fontSize: 14, fontWeight: 600 }}>₹{c.totalSpent.toLocaleString("en-IN")}</div>
            <div style={{ fontFamily: "'DM Mono', monospace", color: c.totalPending > 0 ? "#f87171" : "#6ee7b7", fontSize: 14, fontWeight: 600 }}>
              {c.totalPending > 0 ? `₹${c.totalPending.toLocaleString("en-IN")}` : "Paid"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── EXPENSES TAB ────────────────────────────────────────────────────────────
function ExpensesTab({ expenses, onAdd, onDelete }) {
  const [desc, setDesc] = useState("");
  const [amt, setAmt] = useState("");
  const [cat, setCat] = useState("Transport");

  const cats = ["Transport", "Rent", "Electricity", "Staff Salary", "Tea/Snacks", "Marketing", "Other"];

  const handleSave = () => {
    if (!desc || !amt) return alert("Fill all details");
    onAdd({ desc, amount: Number(amt), category: cat, date: new Date().toISOString().split("T")[0] });
    setDesc(""); setAmt(""); setCat("Transport");
  };

  const totalExp = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 24, alignItems: "start" }}>
      <div>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#fff", marginBottom: 20 }}>Log Expense</div>
        <div style={{ background: "#1a1d2e", border: "1px solid #2a2d3e", borderRadius: 12, padding: 20 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Expense Title / Description</label>
            <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="e.g. Tempo load" style={inputStyle} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Amount (₹)</label>
            <input type="number" value={amt} onChange={e => setAmt(e.target.value)} placeholder="e.g. 500" style={inputStyle} />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={labelStyle}>Category</label>
            <select value={cat} onChange={e => setCat(e.target.value)} style={inputStyle}>
              {cats.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <button onClick={handleSave} style={{ ...btnStyle, background: "linear-gradient(135deg, #10b981, #059669)", color: "#fff", fontWeight: 700, width: "100%", padding: "12px" }}>
            Add Expense
          </button>
        </div>
      </div>

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#fff" }}>Recent Expenses</div>
          <div style={{ fontSize: 16, color: "#f87171", fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>Total: ₹{totalExp.toLocaleString("en-IN")}</div>
        </div>

        {expenses.length === 0 ? <div style={{ color: "#6b7280" }}>No expenses recorded.</div> : expenses.map(e => (
          <div key={e.id} style={{ background: "#12151f", border: "1px solid #1e2130", borderRadius: 10, padding: 16, marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 600, color: "#fff", fontSize: 15, marginBottom: 4 }}>{e.desc}</div>
              <div style={{ display: "flex", gap: 12, fontSize: 12, color: "#6b7280" }}>
                <span style={{ padding: "2px 8px", background: "#374151", borderRadius: 12 }}>{e.category}</span>
                <span>{e.date}</span>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <span style={{ fontWeight: 700, color: "#f87171", fontFamily: "'DM Mono', monospace", fontSize: 18 }}>₹{e.amount}</span>
              <button onClick={() => onDelete(e.id)} style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 16 }}>×</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── PURCHASES & SUPPLIERS TAB ───────────────────────────────────────────────
function PurchasesTab({ purchases, suppliers, inventory, onUpdateSupplier, onAddPurchase }) {
  const [view, setView] = useState("form"); // "form" or "directory"
  const [supplierName, setSupplierName] = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");
  const [selectedSupplierId, setSelectedSupplierId] = useState(null);

  const [selectedTileId, setSelectedTileId] = useState("");
  const [qty, setQty] = useState("");
  const [rate, setRate] = useState("");
  const [amountPaid, setAmountPaid] = useState("");

  const handleSave = () => {
    if (!supplierName) { alert("Supplier name required."); return; }
    if (!selectedTileId || !qty || !rate) { alert("Tile details required."); return; }

    const tile = inventory.find(t => t.id === selectedTileId);
    const net = Number(qty) * Number(rate);
    const paid = Number(amountPaid) || 0;

    const purchase = {
      type: "Purchase",
      supplierName,
      supplierPhone,
      supplierId: selectedSupplierId,
      items: [{ tileId: tile.id, name: `${tile.name} ${tile.size} - ${tile.shade}`, qty: Number(qty), rate: Number(rate), total: net }],
      net,
      paid,
      pending: net - paid
    };

    onAddPurchase(purchase);

    setSupplierName(""); setSupplierPhone(""); setSelectedSupplierId(null);
    setSelectedTileId(""); setQty(""); setRate(""); setAmountPaid("");
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <button onClick={() => setView("form")} style={{ ...btnStyle, background: view === "form" ? "#10b981" : "#1a1d2e", color: view === "form" ? "#000" : "#9ca3af", fontWeight: view === "form" ? 700 : 500 }}>
          ➕ Add Purchase / Stock
        </button>
        <button onClick={() => setView("directory")} style={{ ...btnStyle, background: view === "directory" ? "#3b82f6" : "#1a1d2e", color: view === "directory" ? "#fff" : "#9ca3af", fontWeight: view === "directory" ? 700 : 500 }}>
          🏢 Supplier Directory
        </button>
      </div>

      {view === "form" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          {/* Supplier Info & Tile Input */}
          <div style={{ background: "#1a1d2e", border: "1px solid #2a2d3e", borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#fff", marginBottom: 16 }}>Supplier Details</div>

            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Supplier Name *</label>
              <div style={{ position: "relative" }}>
                <input value={supplierName} onChange={e => {
                  setSupplierName(e.target.value);
                  const existing = suppliers.find(s => s.name.toLowerCase() === e.target.value.toLowerCase());
                  if (existing) { setSelectedSupplierId(existing.id); setSupplierPhone(existing.phone); } else { setSelectedSupplierId(null); }
                }} placeholder="e.g. Kajaria Distributors" style={inputStyle} list="supplier-list" />
                <datalist id="supplier-list">
                  {suppliers.map(s => <option key={s.id} value={s.name} />)}
                </datalist>
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Phone Number</label>
              <input value={supplierPhone} onChange={e => setSupplierPhone(e.target.value)} placeholder="e.g. 9876543210" style={inputStyle} />
            </div>

            <div style={{ borderTop: "1px solid #2a2d3e", margin: "20px 0" }}></div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#fff", marginBottom: 16 }}>Stock Arrived</div>

            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Select Tile *</label>
              <select value={selectedTileId} onChange={e => setSelectedTileId(e.target.value)} style={inputStyle}>
                <option value="">-- Choose from Inventory --</option>
                {inventory.map(t => <option key={t.id} value={t.id}>{t.name} ({t.size}) - {t.shade}</option>)}
              </select>
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Boxes Bought *</label>
                <input type="number" value={qty} onChange={e => setQty(e.target.value)} min={1} placeholder="0" style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Purchase Rate (₹) *</label>
                <input type="number" value={rate} onChange={e => setRate(e.target.value)} min={0} placeholder="0" style={inputStyle} />
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {/* Purchase Summary */}
            <div style={{ background: "#12151f", border: "1px solid #1e2130", borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#fff", marginBottom: 16 }}>Payment Summary</div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <span style={{ fontSize: 14, color: "#9ca3af" }}>Total Bill Amount</span>
                <span style={{ fontWeight: 700, fontSize: 20, color: "#f59e0b", fontFamily: "'DM Mono', monospace" }}>
                  ₹{(Number(qty) * Number(rate) || 0).toLocaleString("en-IN")}
                </span>
              </div>

              <div style={{ background: "#1a1d2e", padding: 16, borderRadius: 8, border: "1px solid #2a2d3e", marginBottom: 16 }}>
                <label style={{ ...labelStyle, color: "#fbbf24", marginBottom: 8 }}>Amount Paid to Supplier (₹)</label>
                <input type="number" value={amountPaid} onChange={e => setAmountPaid(e.target.value)} max={Number(qty) * Number(rate)} style={{ ...inputStyle, fontSize: 18, fontWeight: 700, color: "#10b981", textAlign: "right", padding: "12px 14px", border: "1px solid #064e3b", background: "#022c22" }} />
              </div>

              <button onClick={handleSave} style={{ ...btnStyle, width: "100%", background: "linear-gradient(135deg, #10b981, #059669)", color: "#fff", fontWeight: 700, fontSize: 15, padding: "14px" }}>
                💾 Log Purchase & Update Stock
              </button>
            </div>

            {/* Recent Purchases List */}
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#fff", marginBottom: 12 }}>Recent Purchases</div>
              {purchases.length === 0 ? <div style={{ color: "#6b7280" }}>No purchases yet.</div> : purchases.slice(0, 3).map(p => (
                <div key={p.id} style={{ background: "#1a1d2e", border: "1px solid #2a2d3e", borderRadius: 8, padding: 12, marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, color: "#e8e8e8", fontSize: 13 }}>{p.supplierName}</span>
                    <span style={{ fontFamily: "'DM Mono', monospace", color: "#10b981", fontSize: 13, fontWeight: 600 }}>₹{p.net}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>
                    {p.items.map((i, idx) => <span key={idx}>{i.name} ({i.qty} boxes)</span>)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {view === "directory" && (
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 16 }}>Supplier Ledgers ({suppliers.length})</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {suppliers.map(s => (
              <div key={s.id} style={{ background: "#12151f", border: "1px solid #1e2130", borderRadius: 12, padding: 20 }}>
                <div style={{ fontWeight: 700, color: "#fff", fontSize: 18, marginBottom: 4 }}>{s.name}</div>
                <div style={{ color: "#9ca3af", fontSize: 13, marginBottom: 16 }}>{s.phone}</div>
                <div style={{ display: "flex", gap: 16 }}>
                  <div style={{ flex: 1, background: "#1a1d2e", padding: 12, borderRadius: 8 }}>
                    <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>Total Purchased</div>
                    <div style={{ fontWeight: 700, color: "#3b82f6", fontFamily: "'DM Mono', monospace", fontSize: 16 }}>₹{s.totalBought.toLocaleString("en-IN")}</div>
                  </div>
                  <div style={{ flex: 1, background: s.totalPending > 0 ? "#451a03" : "#1a1d2e", border: s.totalPending > 0 ? "1px solid #92400e" : "none", padding: 12, borderRadius: 8 }}>
                    <div style={{ fontSize: 11, color: s.totalPending > 0 ? "#fbbf24" : "#6b7280", marginBottom: 4 }}>You Owe (Pending)</div>
                    <div style={{ fontWeight: 700, color: s.totalPending > 0 ? "#f87171" : "#10b981", fontFamily: "'DM Mono', monospace", fontSize: 16 }}>₹{s.totalPending.toLocaleString("en-IN")}</div>
                  </div>
                </div>
                {s.totalPending > 0 && (
                  <button onClick={() => {
                    const amt = prompt(`Amount paying to ${s.name} to clear dues of ₹${s.totalPending}:`);
                    if (amt && !isNaN(amt) && Number(amt) > 0 && Number(amt) <= s.totalPending) {
                      onUpdateSupplier({ ...s, totalPending: s.totalPending - Number(amt) });
                    } else if (amt) {
                      alert("Invalid amount.");
                    }
                  }} style={{ ...btnStyle, width: "100%", background: "#2a2d3e", border: "1px solid #374151", color: "#fbbf24", marginTop: 12, fontSize: 13 }}>
                    💸 Settle Payment
                  </button>
                )}
              </div>
            ))}
            {suppliers.length === 0 && <div style={{ color: "#6b7280", padding: 20 }}>No suppliers found.</div>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── RETURNS & REFUNDS TAB ───────────────────────────────────────────────────
function ReturnsTab({ sales, onProcessReturn }) {
  const [selectedBillId, setSelectedBillId] = useState("");
  const [returnQtys, setReturnQtys] = useState({});
  const [refundMethod, setRefundMethod] = useState("Adjusted against due");

  const bills = sales.filter(s => s.type === "Invoice" || s.type === "Return");

  const bill = bills.find(b => b.id === selectedBillId);

  const handleQtyChange = (idx, val) => {
    setReturnQtys({ ...returnQtys, [idx]: Number(val) });
  };

  const handleReturn = () => {
    if (!bill) return;

    const itemsReturned = [];
    let totalRefund = 0;

    bill.items.forEach((item, idx) => {
      const q = returnQtys[idx];
      if (q && q > 0) {
        const amt = q * item.rate;
        itemsReturned.push({ ...item, qtyReturned: q, refundAmount: amt });
        totalRefund += amt;
      }
    });

    if (itemsReturned.length === 0) {
      alert("Please enter return quantity for at least one item.");
      return;
    }

    if (window.confirm(`Process return of ₹${totalRefund} for ${itemsReturned.length} items?`)) {
      onProcessReturn({
        originalBillId: bill.id,
        customerId: bill.customerId,
        customerName: bill.customerName,
        items: itemsReturned,
        totalRefund,
        refundMethod
      });
      setSelectedBillId("");
      setReturnQtys({});
    }
  };

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 700, color: "#fff", marginBottom: 20 }}>Process Return / Refund</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <div style={{ background: "#1a1d2e", border: "1px solid #2a2d3e", borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#fff", marginBottom: 16 }}>Select Invoice</div>

          <label style={labelStyle}>Search Bill No.</label>
          <select value={selectedBillId} onChange={e => { setSelectedBillId(e.target.value); setReturnQtys({}); }} style={{ ...inputStyle, marginBottom: 16 }}>
            <option value="">-- Select an Invoice --</option>
            {bills.filter(b => b.type === "Invoice").map(b => (
              <option key={b.id} value={b.id}>{b.billNo} - {b.customerName} (₹{b.net})</option>
            ))}
          </select>

          {bill && (
            <div style={{ background: "#12151f", padding: 16, borderRadius: 8, border: "1px solid #1e2130" }}>
              <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 4 }}>Bill details</div>
              <div style={{ fontWeight: 600, color: "#fff", marginBottom: 2 }}>{bill.customerName}</div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>Date: {bill.date} • Paid: ₹{bill.paid} • Pending: ₹{bill.pending}</div>
            </div>
          )}
        </div>

        {bill && (
          <div style={{ background: "#12151f", border: "1px solid #1e2130", borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#fff", marginBottom: 16 }}>Return Items</div>

            {bill.items.map((item, idx) => (
              <div key={idx} style={{ padding: "12px 0", borderBottom: "1px solid #1e2130", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 500, fontSize: 14, color: "#e8e8e8" }}>{item.name}</div>
                  <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>Orig. Qty: {item.qty} | Rate: ₹{item.rate}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <label style={{ fontSize: 12, color: "#9ca3af" }}>Return Qty:</label>
                  <input type="number" min={0} max={item.qty} value={returnQtys[idx] || ""} onChange={e => handleQtyChange(idx, e.target.value)} style={{ width: 60, background: "#1a1d2e", border: "1px solid #2a2d3e", borderRadius: 6, padding: "6px 8px", color: "#f87171", fontFamily: "'DM Mono', monospace", textAlign: "right" }} />
                </div>
              </div>
            ))}

            <div style={{ marginTop: 16, marginBottom: 16 }}>
              <label style={labelStyle}>Refund Method</label>
              <select value={refundMethod} onChange={e => setRefundMethod(e.target.value)} style={inputStyle}>
                <option value="Adjusted against due">Adjust against pending dues</option>
                <option value="Cash Refund">Cash Refund</option>
                <option value="UPI Refund">UPI Refund</option>
                <option value="Bank Transfer">Bank Transfer</option>
              </select>
            </div>

            <button onClick={handleReturn} style={{ ...btnStyle, width: "100%", background: "linear-gradient(135deg, #f87171, #ef4444)", color: "#fff", fontWeight: 700, fontSize: 15, padding: "14px" }}>
              ↩️ Process Return & Refund
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── REPORTS TAB ─────────────────────────────────────────────────────────────
function ReportsTab({ sales, inventory, expenses, onDelete }) {
  const [dateFilter, setDateFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const getFilteredSales = () => {
    if (!sales) return [];

    // Create current dates
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today

    // To properly compare dates, convert YYYY-MM-DD from the data to Date objects

    if (dateFilter === "all") return sales;

    if (dateFilter === "today") {
      const todayString = today.toISOString().split("T")[0];
      return sales.filter(s => s.date === todayString);
    }

    if (dateFilter === "week") {
      const lastWeek = new Date(today);
      lastWeek.setDate(lastWeek.getDate() - 7);
      return sales.filter(s => new Date(s.date) >= lastWeek);
    }

    if (dateFilter === "month") {
      const lastMonth = new Date(today);
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      return sales.filter(s => new Date(s.date) >= lastMonth);
    }

    if (dateFilter === "custom" && startDate && endDate) {
      // Need precise end of day for the end date
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      return sales.filter(s => {
        const d = new Date(s.date);
        return d >= new Date(startDate) && d <= end;
      });
    }

    return sales;
  };

  const filteredSales = getFilteredSales();

  const today = new Date().toISOString().split("T")[0];
  const todaySales = sales.filter(s => s.date === today);

  // Expenses sum
  const totalExpenses = Array.isArray(expenses)
    ? expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0)
    : 0;

  // Profit should be calculated on GROSS - DISCOUNT. GST is not profit.
  const totalRevenue = filteredSales.reduce((s, b) => s + (b.gross - (b.discount || 0)), 0);

  const totalCost = filteredSales.reduce((s, b) => {
    return s + b.items.reduce((ss, item) => {
      const tile = inventory.find(t => `${t.name} ${t.size} ${t.shade}` === item.name);
      return ss + (tile ? tile.purchaseRate * item.qty : 0);
    }, 0);
  }, 0);

  const profit = totalRevenue - totalCost - totalExpenses;

  const stats = [
    { label: "Total Bills", value: filteredSales.length, color: "#60a5fa" },
    { label: "Total Revenue (excl. GST)", value: `₹${totalRevenue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`, color: "#10b981" },
    { label: "Net Profit (after Cost & Expenses)", value: `₹${profit.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`, color: "#f59e0b" },
    { label: "Total Expenses", value: `₹${totalExpenses.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`, color: "#f87171" },
  ];

  const exportCSV = () => {
    if (filteredSales.length === 0) {
      alert("No data to export");
      return;
    }

    // We create flat records from the sales data. Since bills have multiple items,
    // we export one row per bill to keep things simple for high-level CSV analysis.
    const csvRows = [
      ["Bill No", "Date", "Document", "Customer", "Items Count", "Items Details", "Gross", "Discount", "GST", "Net Payable", "Amount Paid", "Pending Balance", "Payment Method"]
    ];

    filteredSales.forEach(s => {
      csvRows.push([
        s.billNo,
        s.date,
        s.type,
        s.customerName,
        s.items.length,
        s.items.map(i => `${i.name} (${i.qty})`).join(" | "),
        s.gross,
        s.discount,
        s.gst,
        s.net,
        s.paid,
        s.pending,
        s.paymentMethod || "N/A"
      ]);
    });

    const csvContent = csvRows.map(e => e.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `sales_report_${dateFilter}_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#fff" }}>Reports & Analytics</div>
        <button onClick={exportCSV} style={{ ...btnStyle, background: "#10b981", color: "#000", fontWeight: 700, display: "flex", gap: 8, alignItems: "center" }}>
          <span>📥</span> Export CSV
        </button>
      </div>

      {/* Filters */}
      <div style={{ background: "#1a1d2e", border: "1px solid #2a2d3e", borderRadius: 12, padding: 16, marginBottom: 24, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, color: "#9ca3af", fontWeight: 600 }}>Filter Timeline:</div>

        <div style={{ display: "flex", background: "#12151f", borderRadius: 8, padding: 4 }}>
          {[
            { id: "all", label: "All Time" },
            { id: "today", label: "Today" },
            { id: "week", label: "Last 7 Days" },
            { id: "month", label: "Last 30 Days" },
            { id: "custom", label: "Custom Dates" }
          ].map(f => (
            <button key={f.id} onClick={() => setDateFilter(f.id)} style={{
              ...btnStyle, padding: "6px 16px", borderRadius: 6, fontSize: 13,
              background: dateFilter === f.id ? "#3b82f6" : "transparent",
              color: dateFilter === f.id ? "#fff" : "#9ca3af",
              fontWeight: dateFilter === f.id ? 600 : 500
            }}>
              {f.label}
            </button>
          ))}
        </div>

        {dateFilter === "custom" && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "6px 12px" }} />
            <span style={{ color: "#6b7280" }}>to</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "6px 12px" }} />
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
        {stats.map((s, i) => (
          <div key={i} style={{ background: "#12151f", border: "1px solid #1e2130", borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.color, fontFamily: "'DM Mono', monospace" }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* AI Insights */}
      <div style={{ background: "#0d1a2d", border: "1px solid #1d3557", borderRadius: 12, padding: 16, marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#60a5fa", marginBottom: 12 }}>🤖 AI Insights</div>
        {inventory.filter(t => t.stock === 0).length > 0 && (
          <div style={{ fontSize: 13, color: "#f87171", marginBottom: 8 }}>🚫 {inventory.filter(t => t.stock === 0).length} designs out of stock — reorder immediately</div>
        )}
        {inventory.filter(t => t.stock > 0 && t.stock <= 10).length > 0 && (
          <div style={{ fontSize: 13, color: "#fbbf24", marginBottom: 8 }}>⚠️ {inventory.filter(t => t.stock > 0 && t.stock <= 10).length} designs running low — restock soon</div>
        )}
        <div style={{ fontSize: 13, color: "#6ee7b7" }}>
          ✅ Profit margin: {totalRevenue > 0 ? ((profit / totalRevenue) * 100).toFixed(1) : 0}% — {profit / totalRevenue > 0.2 ? "Healthy!" : "Consider reviewing pricing"}
        </div>
      </div>

      {/* Recent Bills */}
      <div style={{ fontSize: 15, fontWeight: 600, color: "#fff", marginBottom: 12 }}>{dateFilter !== "all" ? "Filtered Bills" : "Recent Bills"}</div>
      {filteredSales.slice(0, 15).map(bill => (
        <div key={bill.id} style={{ background: "#12151f", border: "1px solid #1e2130", borderRadius: 10, padding: 14, marginBottom: 8, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontWeight: 600, color: "#fff", fontSize: 14 }}>
                <span style={{ color: "#f59e0b", fontFamily: "'DM Mono', monospace", marginRight: 8 }}>{bill.billNo}</span>
                {bill.customerName}
              </div>
              <div style={{ fontSize: 13, color: "#9ca3af", marginTop: 4 }}>
                {bill.items.map(i => `${i.name} (${i.qty})`).join(', ')}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontWeight: 700, color: "#10b981", fontFamily: "'DM Mono', monospace", fontSize: 16 }}>₹{bill.net.toFixed(0)}</div>
              {bill.pending > 0 && <div style={{ fontSize: 11, color: "#f87171", fontFamily: "'DM Mono', monospace" }}>Pending: ₹{bill.pending.toFixed(0)}</div>}
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #1e2130", paddingTop: 8, marginTop: 4 }}>
            <div style={{ fontSize: 12, color: "#6b7280", display: "flex", gap: 12 }}>
              <span>📅 {bill.date}</span>
              <span>📦 {bill.type}</span>
            </div>
            <button onClick={() => onDelete(bill.id)} style={{ background: "transparent", border: "none", color: "#f87171", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}>
              🗑️ Delete
            </button>
          </div>
        </div>
      ))}
      {filteredSales.length === 0 && (
        <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>
          No records found for the selected time period.
        </div>
      )}
    </div>
  );
}

// ─── SHARED STYLES ───────────────────────────────────────────────────────────
const inputStyle = {
  width: "100%", background: "#12151f", border: "1px solid #2a2d3e", borderRadius: 8,
  padding: "10px 14px", color: "#e8e8e8", fontSize: 14, outline: "none",
  fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box"
};

const labelStyle = {
  display: "block", fontSize: 12, color: "#6b7280", marginBottom: 6, fontWeight: 500, letterSpacing: "0.3px"
};

const btnStyle = {
  padding: "10px 20px", borderRadius: 8, border: "none", cursor: "pointer",
  fontSize: 14, fontFamily: "'DM Sans', sans-serif", transition: "opacity 0.2s"
};

const qtyBtnStyle = {
  width: 32, height: 32, borderRadius: 8, border: "1px solid #2a2d3e",
  background: "#1a1d2e", color: "#fff", fontSize: 18, cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif"
};
