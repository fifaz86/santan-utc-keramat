import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'storefront' | 'login' | 'admin'>(
    'storefront'
  );
  const [activeTab, setActiveTab] = useState<
    'orders' | 'pos' | 'report' | 'stock' | 'catalogue'
  >('orders');

  // State Storefront Pelanggan
  const [storeInfo, setStoreInfo] = useState<any>({});
  const [storeVariants, setStoreVariants] = useState<any[]>([]);
  const [cart, setCart] = useState<{ [variantId: string]: number }>({});
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [fulfillment, setFulfillment] = useState<'pickup' | 'delivery'>('pickup');
  const [paymentChoice, setPaymentChoice] = useState<'qr' | 'later'>('qr');
  const [deliveryAddr, setDeliveryAddr] = useState('');
  const [deliveryKm, setDeliveryKm] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [orderSuccess, setOrderSuccess] = useState<any>(null);
  const [submittingOrder, setSubmittingOrder] = useState(false);

  // State Log Masuk Admin
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  // State Data Admin
  const [categories, setCategories] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [variantsList, setVariantsList] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [ordersList, setOrdersList] = useState<any[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  // State Laporan Harian
  const [reportDate, setReportDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );

  // State Kaunter POS
  const [posCart, setPosCart] = useState<{ [variantId: string]: number }>({});
  const [posCustName, setPosCustName] = useState('');
  const [posPayMethod, setPosPayMethod] = useState<'cash' | 'duitnow_qr'>(
    'cash'
  );
  const [processingPos, setProcessingPos] = useState(false);

  // Borang Admin (Katalog, Stok Masuk & Wastage)
  const [catName, setCatName] = useState('');
  const [prodName, setProdName] = useState('');
  const [prodCatId, setProdCatId] = useState('');
  const [prodDesc, setProdDesc] = useState('');
  const [varLabel, setVarLabel] = useState('');
  const [unitId, setUnitId] = useState('');
  const [sizeQty, setSizeQty] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [selVariantId, setSelVariantId] = useState('');
  const [batchNo, setBatchNo] = useState('');
  const [qtyReceived, setQtyReceived] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [batchCost, setBatchCost] = useState('');
  const [supplierNote, setSupplierNote] = useState('');

  // State Borang Wastage
  const [wasteVariantId, setWasteVariantId] = useState('');
  const [wasteQty, setWasteQty] = useState('');
  const [wasteReason, setWasteReason] = useState('Santan basi / rosak');

  useEffect(() => {
    fetchStorefront();

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) checkProfile(session.user.id, false);
      else setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) checkProfile(session.user.id, true);
      else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchStorefront() {
    const [setRes, varRes] = await Promise.all([
      supabase.from('settings').select('key, value'),
      supabase.from('v_storefront_variants').select('*'),
    ]);

    if (setRes.data) {
      const map: any = {};
      setRes.data.forEach((s: any) => {
        map[s.key] = s.value;
      });
      setStoreInfo(map);
    }
    if (varRes.data) setStoreVariants(varRes.data);
  }

  function generateDefaultBatchNo() {
    const now = new Date();
    const yymmdd = now.toISOString().slice(2, 10).replace(/-/g, '');
    const rand = Math.floor(100 + Math.random() * 900);
    setBatchNo(`B-${yymmdd}-${rand}`);
  }

  async function checkProfile(userId: string, switchToAdmin: boolean) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    setProfile(data);
    if (data?.role === 'admin' || data?.role === 'staff') {
      generateDefaultBatchNo();
      await fetchAdminData();
      if (switchToAdmin) setViewMode('admin');
    }
    setLoading(false);
  }

  async function fetchAdminData() {
    const [catRes, unitRes, prodRes, balRes, batchRes, ordRes] =
      await Promise.all([
        supabase.from('categories').select('*').order('sort_order'),
        supabase.from('units').select('*'),
        supabase
          .from('products')
          .select('*, categories(name), product_variants(*, units(code))')
          .order('created_at', { ascending: false }),
        supabase.from('v_stock_balance').select('*'),
        supabase
          .from('stock_batches')
          .select('*, product_variants(label, products(name), units(code))')
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('orders')
          .select('*, order_items(*)')
          .order('created_at', { ascending: false })
          .limit(100),
      ]);

    if (catRes.data) setCategories(catRes.data);
    if (unitRes.data) {
      setUnits(unitRes.data);
      if (unitRes.data.length > 0 && !unitId) setUnitId(unitRes.data[0].id);
    }
    if (prodRes.data) {
      const flatVars: any[] = [];
      prodRes.data.forEach((p: any) => {
        p.product_variants?.forEach((v: any) => {
          const bal = balRes.data?.find((b: any) => b.variant_id === v.id);
          flatVars.push({
            ...v,
            product_name: p.name,
            quantity_on_hand: bal ? Number(bal.quantity_on_hand) : 0,
          });
        });
      });
      setVariantsList(flatVars);
      if (flatVars.length > 0) {
        if (!selVariantId) setSelVariantId(flatVars[0].id);
        if (!wasteVariantId) setWasteVariantId(flatVars[0].id);
      }
    }
    if (batchRes.data) setBatches(batchRes.data);
    if (ordRes.data) setOrdersList(ordRes.data);
  }

  // FUNGSI TROLI & TEMPAHAN PELANGGAN
  function updateCart(variantId: string, delta: number, maxStock: number) {
    setCart((prev) => {
      const current = prev[variantId] || 0;
      const next = Math.max(0, Math.min(maxStock, current + delta));
      const updated = { ...prev };
      if (next === 0) delete updated[variantId];
      else updated[variantId] = next;
      return updated;
    });
  }

  const cartItems = storeVariants
    .filter((v) => (cart[v.variant_id] || 0) > 0)
    .map((v) => ({
      ...v,
      qty: cart[v.variant_id],
      lineTotal: Number(v.selling_price) * cart[v.variant_id],
    }));

  const subtotal = cartItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const feePerKm = Number(storeInfo.delivery_fee_per_km || 0);
  const estDeliveryFee =
    fulfillment === 'delivery' && deliveryKm
      ? Math.round(parseFloat(deliveryKm) * feePerKm * 100) / 100
      : 0;
  const grandTotal = subtotal + estDeliveryFee;

  async function handlePlaceOrder(e: React.FormEvent) {
    e.preventDefault();
    if (cartItems.length === 0) return;
    setSubmittingOrder(true);

    const itemsPayload = cartItems.map((i) => ({
      variant_id: i.variant_id,
      quantity: i.qty,
    }));

    const { data, error } = await supabase.rpc('create_customer_order', {
      p_customer_name: custName,
      p_customer_phone: custPhone,
      p_fulfillment_type: fulfillment,
      p_delivery_address: fulfillment === 'delivery' ? deliveryAddr : null,
      p_delivery_distance_km:
        fulfillment === 'delivery' && deliveryKm
          ? parseFloat(deliveryKm)
          : null,
      p_notes: orderNotes || null,
      p_items: itemsPayload,
    });

    setSubmittingOrder(false);
    if (error) {
      alert('Ralat menghantar tempahan: ' + error.message);
    } else {
      setOrderSuccess({
        ...data,
        customer_phone: custPhone,
        customer_name: custName,
        payment_choice: paymentChoice,
        fulfillment_type: fulfillment
      })
      setCart({})
      setOrderNotes('')
    }
  }

  // FUNGSI ADMIN & POS
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) setAuthError(error.message);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setViewMode('storefront');
  }

  async function handleOrderAction(orderId: string, newStatus: string) {
    setMsg(null);
    const { error } = await supabase.rpc('update_order_status_fifo', {
      p_order_id: orderId,
      p_new_status: newStatus,
    });
    if (error) {
      setMsg('Ralat kemas kini pesanan: ' + error.message);
    } else {
      setMsg(
        `Status pesanan berjaya dikemas kini kepada: ${newStatus.toUpperCase()}`
      );
      fetchAdminData();
      fetchStorefront();
    }
  }

  // FUNGSI JANA PAUTAN WHATSAPP PELANGGAN
  function openWhatsAppReceipt(ord: any) {
    let cleanPhone = (ord.customer_phone || '').replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('0')) cleanPhone = '6' + cleanPhone;
    if (!cleanPhone)
      return alert('Tiada nombor telefon direkodkan untuk pesanan ini.');

    const itemsText =
      ord.order_items
        ?.map(
          (i: any) =>
            `- ${i.product_name} (${i.variant_label}) x${
              i.quantity
            } = RM${Number(i.line_total).toFixed(2)}`
        )
        .join('\n') || '';

    const statusLabel =
      ord.status === 'confirmed'
        ? 'DISAHKAN & SEDANG DISEDIAKAN'
        : ord.status === 'completed'
        ? 'SELESAI'
        : 'DITERIMA (MENUNGGU PENGESAHAN)';

    const text =
      `*SANTAN UTC KERAMAT*\n` +
      `No. Rujukan: *${ord.order_number}*\n` +
      `Status: *${statusLabel}*\n` +
      `Pelanggan: ${ord.customer_name || '-'}\n` +
      `Kaedah: ${
        ord.fulfillment_type === 'delivery'
          ? 'Penghantaran (Delivery)'
          : 'Ambil Sendiri (Pickup UTC Keramat)'
      }\n\n` +
      `*Butiran Pesanan:*\n${itemsText}\n\n` +
      `*Jumlah Bayaran: RM ${Number(ord.total_amount).toFixed(2)}*\n` +
      `Terima kasih kerana berurusan dengan Santan UTC Keramat!`;

    window.open(
      `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`,
      '_blank'
    );
  }

  function updatePosCart(variantId: string, delta: number, maxStock: number) {
    setPosCart((prev) => {
      const current = prev[variantId] || 0;
      const next = Math.max(0, Math.min(maxStock, current + delta));
      const updated = { ...prev };
      if (next === 0) delete updated[variantId];
      else updated[variantId] = next;
      return updated;
    });
  }

  const posItems = variantsList
    .filter((v) => (posCart[v.id] || 0) > 0)
    .map((v) => ({
      ...v,
      qty: posCart[v.id],
      lineTotal: Number(v.selling_price) * posCart[v.id],
    }));

  const posTotal = posItems.reduce((sum, item) => sum + item.lineTotal, 0);

  async function handlePosCheckout(e: React.FormEvent) {
    e.preventDefault();
    if (posItems.length === 0) return;
    setProcessingPos(true);
    setMsg(null);

    const payload = posItems.map((i) => ({
      variant_id: i.id,
      quantity: i.qty,
    }));
    const { data, error } = await supabase.rpc('create_pos_sale', {
      p_customer_name: posCustName || 'Pelanggan Walk-In',
      p_payment_method: posPayMethod,
      p_items: payload,
    });

    setProcessingPos(false);
    if (error) {
      setMsg('Ralat jualan POS: ' + error.message);
    } else {
      setPosCart({});
      setPosCustName('');
      setMsg(
        `✅ Jualan POS ${data.order_number} (RM ${Number(
          data.total_amount
        ).toFixed(2)}) selesai & stok telah ditolak!`
      );
      fetchAdminData();
      fetchStorefront();
    }
  }

  async function handleAddCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!catName.trim()) return;
    const { error } = await supabase
      .from('categories')
      .insert({ name: catName.trim() });
    if (error) setMsg('Ralat: ' + error.message);
    else {
      setCatName('');
      setMsg('Kategori berjaya ditambah!');
      fetchAdminData();
    }
  }

  async function handleAddProduct(e: React.FormEvent) {
    e.preventDefault();
    const { data: newProd, error: prodErr } = await supabase
      .from('products')
      .insert({
        name: prodName.trim(),
        category_id: prodCatId || null,
        description: prodDesc.trim() || null,
      })
      .select()
      .single();
    if (prodErr) return setMsg('Ralat produk: ' + prodErr.message);

    const { error: varErr } = await supabase.from('product_variants').insert({
      product_id: newProd.id,
      label: varLabel.trim(),
      unit_id: unitId,
      size_quantity: sizeQty ? parseFloat(sizeQty) : null,
      selling_price: parseFloat(sellPrice),
      cost_price: costPrice ? parseFloat(costPrice) : null,
    });
    if (varErr) setMsg('Ralat varian: ' + varErr.message);
    else {
      setProdName('');
      setProdDesc('');
      setVarLabel('');
      setSizeQty('');
      setSellPrice('');
      setCostPrice('');
      setMsg('Produk baharu berjaya disimpan!');
      fetchAdminData();
      fetchStorefront();
    }
  }

  async function handleReceiveStock(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.rpc('receive_stock_batch', {
      p_variant_id: selVariantId,
      p_batch_number: batchNo.trim(),
      p_quantity: parseFloat(qtyReceived),
      p_expiry_date: expiryDate || null,
      p_unit_cost: batchCost ? parseFloat(batchCost) : null,
      p_supplier_note: supplierNote.trim() || null,
    });
    if (error) setMsg('Ralat rekod stok: ' + error.message);
    else {
      setQtyReceived('');
      setBatchCost('');
      setSupplierNote('');
      generateDefaultBatchNo();
      setMsg('Stok masuk berjaya direkodkan!');
      fetchAdminData();
      fetchStorefront();
    }
  }

  async function handleRecordWastage(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!wasteVariantId || !wasteQty) return;
    const { error } = await supabase.rpc('record_stock_wastage', {
      p_variant_id: wasteVariantId,
      p_qty: parseFloat(wasteQty),
      p_reason: wasteReason,
    });
    if (error) {
      setMsg('Ralat rekod rosak/basi: ' + error.message);
    } else {
      setWasteQty('');
      setMsg('⚠️ Stok rosak/basi berjaya ditolak daripada inventori.');
      fetchAdminData();
      fetchStorefront();
    }
  }

  // FUNGSI MUAT NAIK GAMBAR DUITNOW QR
  async function handleUploadQr(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMsg('Memuat naik gambar QR...');

    const fileExt = file.name.split('.').pop();
    const filePath = `duitnow-qr-${Date.now()}.${fileExt}`;

    const { error: uploadErr } = await supabase.storage
      .from('payment-qr')
      .upload(filePath, file, { upsert: true });

    if (uploadErr) {
      return setMsg('Ralat muat naik QR: ' + uploadErr.message);
    }

    const { data: urlData } = supabase.storage
      .from('payment-qr')
      .getPublicUrl(filePath);

    const { error: setErr } = await supabase
      .from('settings')
      .upsert(
        { key: 'payment_qr_url', value: urlData.publicUrl },
        { onConflict: 'key' }
      );

    if (setErr) setMsg('Ralat simpan pautan QR: ' + setErr.message);
    else {
      setMsg('✅ Gambar QR Code pembayaran berjaya dimuat naik dan disimpan!');
      fetchStorefront();
    }
  }

  if (loading)
    return (
      <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
        Memuatkan...
      </div>
    );

  // ==========================================
  // PAPARAN 1: STOREFRONT PELANGGAN
  // ==========================================
  if (viewMode === 'storefront') {
    return (
      <div
        style={{
          maxWidth: '800px',
          margin: '0 auto',
          padding: '1rem',
          fontFamily: 'sans-serif',
          color: '#1f2937',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1rem 0',
            borderBottom: '2px solid #15803d',
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#15803d' }}>
              {storeInfo.business_name || 'Santan UTC Keramat'}
            </h1>
            <p
              style={{
                margin: '0.2rem 0 0',
                fontSize: '0.9rem',
                color: '#4b5563',
              }}
            >
              {storeInfo.tagline || 'Segar Untuk Hidangan Anda'}
            </p>
          </div>
          {profile?.role === 'admin' || profile?.role === 'staff' ? (
            <button
              onClick={() => {
                fetchAdminData();
                setViewMode('admin');
              }}
              style={{
                padding: '0.5rem 0.9rem',
                background: '#15803d',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.85rem',
              }}
            >
              Panel Admin
            </button>
          ) : (
            <button
              onClick={() => setViewMode('login')}
              style={{
                padding: '0.4rem 0.8rem',
                background: '#f3f4f6',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.8rem',
              }}
            >
              Log Masuk Staf
            </button>
          )}
        </div>

        <div
          style={{
            background: '#f0fdf4',
            padding: '0.8rem 1rem',
            borderRadius: '8px',
            marginTop: '1rem',
            fontSize: '0.85rem',
            display: 'flex',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
        >
          <span>
            📍 {storeInfo.pickup_address || 'UTC Keramat, Kuala Lumpur'}
          </span>
          <span>🕒 {storeInfo.operating_hours || 'Setiap hari'}</span>
        </div>

        {orderSuccess && (
          <div
            style={{
              marginTop: '1.5rem',
              padding: '1.2rem',
              background: '#dcfce7',
              border: '2px solid #16a34a',
              borderRadius: '8px',
              textAlign: 'center',
            }}
          >
            <h3 style={{ margin: '0 0 0.5rem', color: '#166534' }}>
              ✅ Tempahan Berjaya Dihantar!
            </h3>
            <p style={{ margin: '0.3rem 0' }}>
              No. Rujukan Pesanan: <strong>{orderSuccess.order_number}</strong>
            </p>
            <p style={{ margin: '0.3rem 0', fontSize: '1.1rem' }}>
              Jumlah Bayaran:{' '}
              <strong>RM {Number(orderSuccess.total_amount).toFixed(2)}</strong>
            </p>

            {storeInfo.payment_qr_url && (
              <div
                style={{
                  margin: '1rem auto',
                  padding: '1rem',
                  background: 'white',
                  borderRadius: '8px',
                  maxWidth: '260px',
                  border: '1px solid #bbf7d0',
                }}
              >
                <div
                  style={{
                    fontSize: '0.85rem',
                    fontWeight: 'bold',
                    color: '#15803d',
                    marginBottom: '0.5rem',
                  }}
                >
                  Imbas DuitNow QR untuk Bayaran
                </div>
                <img
                  src={storeInfo.payment_qr_url}
                  alt="DuitNow QR"
                  style={{ width: '100%', height: 'auto', borderRadius: '6px' }}
                />
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: '#4b5563',
                    marginTop: '0.4rem',
                  }}
                >
                  Sila simpan resit bayaran untuk semakan kedai.
                </div>
              </div>
            )}

<p style={{ margin: '0.5rem 0 0.8rem', fontSize: '0.9rem' }}>
                Pihak kedai akan menyemak dan mengesahkan pesanan anda sebentar lagi.
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    let phone = (orderSuccess.customer_phone || '').replace(/[^0-9]/g, '')
                    if (phone.startsWith('0')) phone = '6' + phone
                    const isPaid = orderSuccess.fulfillment_type === 'pickup' && orderSuccess.payment_choice === 'qr'
                    const payStatus = isPaid ? 'SUDAH BAYAR (DuitNow QR)' : 'BELUM BAYAR'
                    const msgText = `*SANTAN UTC KERAMAT*\nNo. Rujukan: *${orderSuccess.order_number}*\nNama: ${orderSuccess.customer_name}\nJumlah: *RM ${Number(orderSuccess.total_amount).toFixed(2)}*\nStatus: *${payStatus}*`
                    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msgText)}`, '_blank')
                  }}
                  style={{ padding: '0.6rem 1rem', background: '#25D366', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  💬 Hantar Status ke WhatsApp
                </button>

                <button
                  type="button"
                  onClick={() => setOrderSuccess(null)}
                  style={{ padding: '0.6rem 1rem', background: '#15803d', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  Buat Tempahan Baharu
                </button>
              </div>
          </div>
        )}

        <h2 style={{ marginTop: '1.5rem', fontSize: '1.2rem' }}></h2>
              <h2 style={{ marginTop: '1.5rem', fontSize: '1.2rem' }}>
          Produk Segar Hari Ini
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: '1rem',
          }}
        >
          {storeVariants.map((item) => {
            const inStock = Number(item.quantity_on_hand) > 0;
            const qtyInCart = cart[item.variant_id] || 0;
            return (
              <div
                key={item.variant_id}
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: '10px',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  opacity: inStock ? 1 : 0.65,
                }}
              >
                <div>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      background: '#e5e7eb',
                      padding: '0.2rem 0.5rem',
                      borderRadius: '4px',
                    }}
                  >
                    {item.category_name || 'Santan'}
                  </span>
                  <h3
                    style={{ margin: '0.5rem 0 0.2rem', fontSize: '1.05rem' }}
                  >
                    {item.product_name}
                  </h3>
                  <div style={{ fontSize: '0.85rem', color: '#4b5563' }}>
                    {item.variant_label}
                  </div>
                </div>
                <div
                  style={{
                    marginTop: '1rem',
                    paddingTop: '0.8rem',
                    borderTop: '1px solid #f3f4f6',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '0.6rem',
                    }}
                  >
                    <strong style={{ fontSize: '1.15rem', color: '#15803d' }}>
                      RM {Number(item.selling_price).toFixed(2)}
                    </strong>
                    <small
                      style={{
                        color: inStock ? '#16a34a' : '#dc2626',
                        fontWeight: 'bold',
                      }}
                    >
                      {inStock
                        ? `Stok: ${item.quantity_on_hand} ${item.unit_code}`
                        : 'Habis Stok'}
                    </small>
                  </div>
                  {inStock && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: '#f9fafb',
                        padding: '0.3rem',
                        borderRadius: '6px',
                      }}
                    >
                      <button
                        onClick={() =>
                          updateCart(
                            item.variant_id,
                            -1,
                            Number(item.quantity_on_hand)
                          )
                        }
                        disabled={qtyInCart === 0}
                        style={{
                          width: '32px',
                          height: '32px',
                          border: '1px solid #d1d5db',
                          background: 'white',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontWeight: 'bold',
                        }}
                      >
                        -
                      </button>
                      <span style={{ fontWeight: 'bold' }}>{qtyInCart}</span>
                      <button
                        onClick={() =>
                          updateCart(
                            item.variant_id,
                            1,
                            Number(item.quantity_on_hand)
                          )
                        }
                        disabled={qtyInCart >= Number(item.quantity_on_hand)}
                        style={{
                          width: '32px',
                          height: '32px',
                          border: 'none',
                          background: '#15803d',
                          color: 'white',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontWeight: 'bold',
                        }}
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {cartItems.length > 0 && (
          <div
            style={{
              marginTop: '2rem',
              padding: '1.2rem',
              border: '2px solid #15803d',
              borderRadius: '10px',
              background: '#f8fafc',
            }}
          >
            <h3 style={{ marginTop: 0 }}>
              🛒 Ringkasan Tempahan ({cartItems.length} jenis)
            </h3>
            {cartItems.map((item) => (
              <div
                key={item.variant_id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '0.4rem 0',
                  borderBottom: '1px solid #e2e8f0',
                  fontSize: '0.9rem',
                }}
              >
                <span>
                  {item.product_name} ({item.variant_label}) × {item.qty}
                </span>
                <strong>RM {item.lineTotal.toFixed(2)}</strong>
              </div>
            ))}
            <form
              onSubmit={handlePlaceOrder}
              style={{
                marginTop: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.8rem',
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '0.6rem',
                }}
              >
                <input
                  type="text"
                  placeholder="Nama Anda *"
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  required
                  style={{
                    padding: '0.6rem',
                    borderRadius: '4px',
                    border: '1px solid #cbd5e1',
                  }}
                />
                <input
                  type="tel"
                  placeholder="No. Telefon / WhatsApp *"
                  value={custPhone}
                  onChange={(e) => setCustPhone(e.target.value)}
                  required
                  style={{
                    padding: '0.6rem',
                    borderRadius: '4px',
                    border: '1px solid #cbd5e1',
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <label style={{ cursor: 'pointer' }}>
                  <input
                    type="radio"
                    checked={fulfillment === 'pickup'}
                    onChange={() => setFulfillment('pickup')}
                  />{' '}
                  Ambil Sendiri (Pickup UTC Keramat)
                </label>
                <label style={{ cursor: 'pointer' }}>
                  <input
                    type="radio"
                    checked={fulfillment === 'delivery'}
                    onChange={() => setFulfillment('delivery')}
                  />{' '}
                  Penghantaran (Delivery)
                </label>
              </div>
              {fulfillment === 'pickup' && (
                <div style={{ background: '#f0fdf4', padding: '0.8rem', borderRadius: '6px', border: '1px solid #86efac', marginTop: '0.5rem' }}>
                  <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                    <label style={{ cursor: 'pointer' }}><input type="radio" checked={paymentChoice === 'qr'} onChange={() => setPaymentChoice('qr')} /> Bayar Sekarang (DuitNow QR)</label>
                    <label style={{ cursor: 'pointer' }}><input type="radio" checked={paymentChoice === 'later'} onChange={() => setPaymentChoice('later')} /> Bayar Waktu Ambil</label>
                  </div>
                  {paymentChoice === 'qr' && (
                    <div style={{ textAlign: 'center', background: 'white', padding: '0.8rem', borderRadius: '6px', marginTop: '0.5rem' }}>
                      <div style={{ fontWeight: 'bold', color: '#15803d', marginBottom: '0.4rem' }}>Sila Imbas & Bayar: RM {grandTotal.toFixed(2)}</div>
                      <img src="/duitnow-qr.jpeg" alt="DuitNow QR" style={{ width: '190px', borderRadius: '6px', border: '1px solid #e5e7eb' }} />
                    </div>
                  )}
                </div>
              )}
              {fulfillment === 'delivery' && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.6rem',
                    background: 'white',
                    padding: '0.8rem',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                  }}
                >
                  <input
                    type="text"
                    placeholder="Alamat Lengkap Penghantaran *"
                    value={deliveryAddr}
                    onChange={(e) => setDeliveryAddr(e.target.value)}
                    required
                    style={{ padding: '0.5rem' }}
                  />
                  <input
                    type="number"
                    step="0.1"
                    placeholder={`Anggaran Jarak (km) — Kadar RM${feePerKm.toFixed(
                      2
                    )}/km`}
                    value={deliveryKm}
                    onChange={(e) => setDeliveryKm(e.target.value)}
                    required
                    style={{ padding: '0.5rem' }}
                  />
                </div>
              )}
              <input
                type="text"
                placeholder="Catatan tambahan (cth: waktu ambil / perah pekat)"
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                style={{
                  padding: '0.6rem',
                  borderRadius: '4px',
                  border: '1px solid #cbd5e1',
                }}
              />
              <div
                style={{
                  background: 'white',
                  padding: '0.8rem',
                  borderRadius: '6px',
                  fontSize: '0.95rem',
                }}
              >
                <div
                  style={{ display: 'flex', justifyContent: 'space-between' }}
                >
                  <span>Subtotal Produk:</span>
                  <span>RM {subtotal.toFixed(2)}</span>
                </div>
                {fulfillment === 'delivery' && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      color: '#475569',
                    }}
                  >
                    <span>Anggaran Caj Penghantaran:</span>
                    <span>RM {estDeliveryFee.toFixed(2)}</span>
                  </div>
                )}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontWeight: 'bold',
                    fontSize: '1.1rem',
                    marginTop: '0.4rem',
                    paddingTop: '0.4rem',
                    borderTop: '1px solid #e2e8f0',
                    color: '#15803d',
                  }}
                >
                  <span>Jumlah Keseluruhan:</span>
                  <span>RM {grandTotal.toFixed(2)}</span>
                </div>
              </div>
              <button
                type="submit"
                disabled={submittingOrder}
                style={{
                  padding: '0.8rem',
                  background: '#15803d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 'bold',
                  fontSize: '1rem',
                  cursor: 'pointer',
                }}
              >
                {submittingOrder ? 'Menghantar...' : 'Hantar Tempahan Sekarang'}
              </button>
            </form>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // PAPARAN 2: LOG MASUK ADMIN
  // ==========================================
  if (viewMode === 'login' && !session) {
    return (
      <div
        style={{
          maxWidth: '400px',
          margin: '3rem auto',
          padding: '1.5rem',
          fontFamily: 'sans-serif',
          border: '1px solid #ddd',
          borderRadius: '8px',
        }}
      >
        <button
          onClick={() => setViewMode('storefront')}
          style={{
            marginBottom: '1rem',
            background: 'none',
            border: 'none',
            color: '#15803d',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          ← Kembali ke Kedai
        </button>
        <h2 style={{ marginTop: 0 }}>Log Masuk Pengurusan</h2>
        {authError && (
          <p style={{ color: 'red', fontSize: '0.9rem' }}>{authError}</p>
        )}
        <form
          onSubmit={handleLogin}
          style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}
        >
          <input
            type="email"
            placeholder="E-mel"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ padding: '0.6rem' }}
          />
          <input
            type="password"
            placeholder="Kata Laluan"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ padding: '0.6rem' }}
          />
          <button
            type="submit"
            style={{
              padding: '0.7rem',
              background: '#15803d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            Log Masuk
          </button>
        </form>
      </div>
    );
  }

  // ==========================================
  // KIRAAN LAPORAN JUALAN & UNTUNG KASAR HARIAN
  // ==========================================
  const dailySalesOrders = ordersList.filter((o) => {
    const orderDate = (o.created_at || '').slice(0, 10);
    return (
      orderDate === reportDate && ['confirmed', 'completed'].includes(o.status)
    );
  });

  const dailyRevenue = dailySalesOrders.reduce(
    (sum, o) => sum + Number(o.total_amount || 0),
    0
  );
  const dailyCost = dailySalesOrders.reduce((sum, o) => {
    const orderCost = (o.order_items || []).reduce(
      (s: number, i: any) =>
        s + Number(i.unit_cost || 0) * Number(i.quantity || 0),
      0
    );
    return sum + orderCost;
  }, 0);
  const dailyGrossProfit = dailyRevenue - dailyCost;
  const posRevenue = dailySalesOrders
    .filter((o) => o.channel === 'pos')
    .reduce((s, o) => s + Number(o.total_amount || 0), 0);
  const webRevenue = dailySalesOrders
    .filter((o) => o.channel !== 'pos')
    .reduce((s, o) => s + Number(o.total_amount || 0), 0);

  // ==========================================
  // PAPARAN 3: PANEL PENGURUSAN ADMIN & POS
  // ==========================================
  const pendingCount = ordersList.filter((o) => o.status === 'pending').length;

  return (
    <div
      style={{
        maxWidth: '960px',
        margin: '0 auto',
        padding: '1.2rem',
        fontFamily: 'sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid #eee',
          paddingBottom: '1rem',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>Santan UTC Keramat — Pengurusan</h2>
          <small style={{ color: '#666' }}>
            {profile?.full_name} ({profile?.role})
          </small>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => {
              fetchStorefront();
              setViewMode('storefront');
            }}
            style={{
              padding: '0.5rem 0.9rem',
              background: '#f0fdf4',
              border: '1px solid #15803d',
              color: '#15803d',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Lihat Kedai
          </button>
          <button
            onClick={handleLogout}
            style={{ padding: '0.5rem 0.9rem', cursor: 'pointer' }}
          >
            Log Keluar
          </button>
        </div>
      </div>

      {/* MENU TAB UTAMA */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          marginTop: '1rem',
          borderBottom: '2px solid #e5e7eb',
          paddingBottom: '0.6rem',
          flexWrap: 'wrap',
        }}
      >
        <button
          onClick={() => {
            setActiveTab('orders');
            setMsg(null);
          }}
          style={{
            padding: '0.6rem 1rem',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 'bold',
            background: activeTab === 'orders' ? '#15803d' : '#f3f4f6',
            color: activeTab === 'orders' ? 'white' : '#374151',
          }}
        >
          📋 Pesanan Masuk {pendingCount > 0 && `(${pendingCount})`}
        </button>
        <button
          onClick={() => {
            setActiveTab('pos');
            setMsg(null);
          }}
          style={{
            padding: '0.6rem 1rem',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 'bold',
            background: activeTab === 'pos' ? '#15803d' : '#f3f4f6',
            color: activeTab === 'pos' ? 'white' : '#374151',
          }}
        >
          🖥️ Kaunter POS
        </button>
        <button
          onClick={() => {
            setActiveTab('report');
            setMsg(null);
          }}
          style={{
            padding: '0.6rem 1rem',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 'bold',
            background: activeTab === 'report' ? '#15803d' : '#f3f4f6',
            color: activeTab === 'report' ? 'white' : '#374151',
          }}
        >
          📊 Laporan Harian
        </button>
        <button
          onClick={() => {
            setActiveTab('stock');
            setMsg(null);
          }}
          style={{
            padding: '0.6rem 1rem',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 'bold',
            background: activeTab === 'stock' ? '#15803d' : '#f3f4f6',
            color: activeTab === 'stock' ? 'white' : '#374151',
          }}
        >
          📦 Stok & Batch
        </button>
        <button
          onClick={() => {
            setActiveTab('catalogue');
            setMsg(null);
          }}
          style={{
            padding: '0.6rem 1rem',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 'bold',
            background: activeTab === 'catalogue' ? '#15803d' : '#f3f4f6',
            color: activeTab === 'catalogue' ? 'white' : '#374151',
          }}
        >
          🥥 Katalog & Harga
        </button>
      </div>

      {msg && (
        <div
          style={{
            margin: '1rem 0',
            padding: '0.8rem',
            background: '#f0fdf4',
            border: '1px solid #86efac',
            borderRadius: '4px',
            color: '#166534',
          }}
        >
          {msg}
        </div>
      )}

      {/* TAB 1: PENGURUSAN PESANAN MASUK + WHATSAPP */}
      {activeTab === 'orders' && (
        <div style={{ marginTop: '1.2rem' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <h3 style={{ margin: 0 }}>Senarai Pesanan & Rekod Jualan</h3>
            <button
              onClick={fetchAdminData}
              style={{
                padding: '0.4rem 0.8rem',
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              🔄 Segarkan
            </button>
          </div>

          {ordersList.length === 0 ? (
            <p style={{ color: '#888' }}>Tiada pesanan direkodkan lagi.</p>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                marginTop: '1rem',
              }}
            >
              {ordersList.map((ord) => (
                <div
                  key={ord.id}
                  style={{
                    border:
                      ord.status === 'pending'
                        ? '2px solid #eab308'
                        : '1px solid #e5e7eb',
                    borderRadius: '8px',
                    padding: '1rem',
                    background: ord.status === 'pending' ? '#fefce8' : 'white',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                      borderBottom: '1px solid #eee',
                      paddingBottom: '0.6rem',
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: '1.05rem' }}>
                        {ord.order_number}
                      </strong>
                      <span
                        style={{
                          marginLeft: '0.6rem',
                          fontSize: '0.75rem',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          background:
                            ord.channel === 'pos' ? '#dbeafe' : '#dcfce7',
                          color: '#1e3a8a',
                          fontWeight: 'bold',
                        }}
                      >
                        {ord.channel === 'pos'
                          ? 'KAUNTER POS'
                          : ord.fulfillment_type === 'delivery'
                          ? 'DELIVERY'
                          : 'PICKUP WEB'}
                      </span>
                      <div style={{ fontSize: '0.9rem', marginTop: '0.3rem' }}>
                        Pelanggan: <strong>{ord.customer_name || '-'}</strong>{' '}
                        {ord.customer_phone && `(${ord.customer_phone})`}
                      </div>
                      {ord.delivery_address && (
                        <div style={{ fontSize: '0.85rem', color: '#4b5563' }}>
                          📍 {ord.delivery_address} ({ord.delivery_distance_km}{' '}
                          km)
                        </div>
                      )}
                      {ord.notes && (
                        <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                          📝 {ord.notes}
                        </div>
                      )}
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div
                        style={{
                          fontSize: '1.2rem',
                          fontWeight: 'bold',
                          color: '#15803d',
                        }}
                      >
                        RM {Number(ord.total_amount).toFixed(2)}
                      </div>
                      <span
                        style={{
                          display: 'inline-block',
                          marginTop: '0.2rem',
                          padding: '0.2rem 0.6rem',
                          borderRadius: '12px',
                          fontSize: '0.8rem',
                          fontWeight: 'bold',
                          background:
                            ord.status === 'pending'
                              ? '#fef08a'
                              : ord.status === 'completed'
                              ? '#bbf7d0'
                              : '#e5e7eb',
                        }}
                      >
                        {ord.status.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  <div style={{ margin: '0.6rem 0', fontSize: '0.9rem' }}>
                    {ord.order_items?.map((item: any) => (
                      <div
                        key={item.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '0.2rem 0',
                        }}
                      >
                        <span>
                          • {item.product_name} ({item.variant_label}) ×{' '}
                          {item.quantity}
                        </span>
                        <span>RM {Number(item.line_total).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      gap: '0.5rem',
                      marginTop: '0.8rem',
                      flexWrap: 'wrap',
                    }}
                  >
                    {ord.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleOrderAction(ord.id, 'confirmed')}
                          style={{
                            padding: '0.5rem 1rem',
                            background: '#15803d',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                          }}
                        >
                          ✅ Sahkan & Tolak Stok (FIFO)
                        </button>
                        <button
                          onClick={() => handleOrderAction(ord.id, 'cancelled')}
                          style={{
                            padding: '0.5rem 0.8rem',
                            background: '#fee2e2',
                            color: '#b91c1c',
                            border: '1px solid #fca5a5',
                            borderRadius: '4px',
                            cursor: 'pointer',
                          }}
                        >
                          Batalkan
                        </button>
                      </>
                    )}
                    {ord.status === 'confirmed' && (
                      <button
                        onClick={() => handleOrderAction(ord.id, 'completed')}
                        style={{
                          padding: '0.5rem 1rem',
                          background: '#1d4ed8',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontWeight: 'bold',
                        }}
                      >
                        🎉 Tandakan Selesai / Diambil
                      </button>
                    )}
                    {ord.customer_phone && (
                      <button
                        onClick={() => openWhatsAppReceipt(ord)}
                        style={{
                          padding: '0.5rem 0.9rem',
                          background: '#25D366',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontWeight: 'bold',
                        }}
                      >
                        💬 Hantar WhatsApp
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: KAUNTER POS */}
      {activeTab === 'pos' && (
        <div
          style={{
            marginTop: '1.2rem',
            display: 'grid',
            gridTemplateColumns: '1.3fr 1fr',
            gap: '1.2rem',
          }}
        >
          <div>
            <h3 style={{ marginTop: 0 }}>Pilih Produk Kaunter</h3>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: '0.8rem',
              }}
            >
              {variantsList.map((v) => {
                const inStock = v.quantity_on_hand > 0;
                const qty = posCart[v.id] || 0;
                return (
                  <div
                    key={v.id}
                    style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      padding: '0.8rem',
                      opacity: inStock ? 1 : 0.5,
                    }}
                  >
                    <div style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>
                      {v.product_name}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#666' }}>
                      {v.label}
                    </div>
                    <div
                      style={{
                        margin: '0.4rem 0',
                        fontWeight: 'bold',
                        color: '#15803d',
                      }}
                    >
                      RM {Number(v.selling_price).toFixed(2)}
                    </div>
                    <div
                      style={{ fontSize: '0.75rem', marginBottom: '0.5rem' }}
                    >
                      Baki: {v.quantity_on_hand} {v.units?.code}
                    </div>
                    {inStock && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: '#f3f4f6',
                          padding: '0.2rem',
                          borderRadius: '4px',
                        }}
                      >
                        <button
                          onClick={() =>
                            updatePosCart(v.id, -1, v.quantity_on_hand)
                          }
                          disabled={qty === 0}
                          style={{
                            width: '28px',
                            height: '28px',
                            cursor: 'pointer',
                          }}
                        >
                          -
                        </button>
                        <strong>{qty}</strong>
                        <button
                          onClick={() =>
                            updatePosCart(v.id, 1, v.quantity_on_hand)
                          }
                          disabled={qty >= v.quantity_on_hand}
                          style={{
                            width: '28px',
                            height: '28px',
                            background: '#15803d',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                          }}
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div
            style={{
              border: '2px solid #15803d',
              borderRadius: '8px',
              padding: '1rem',
              background: '#f8fafc',
              alignSelf: 'start',
            }}
          >
            <h3 style={{ marginTop: 0 }}>🧾 Resit Kaunter POS</h3>
            {posItems.length === 0 ? (
              <p style={{ color: '#888', fontSize: '0.9rem' }}>
                Klik + pada produk untuk mula mengira.
              </p>
            ) : (
              <form onSubmit={handlePosCheckout}>
                {posItems.map((i) => (
                  <div
                    key={i.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '0.4rem 0',
                      borderBottom: '1px solid #e2e8f0',
                      fontSize: '0.9rem',
                    }}
                  >
                    <span>
                      {i.product_name} × {i.qty}
                    </span>
                    <strong>RM {i.lineTotal.toFixed(2)}</strong>
                  </div>
                ))}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '1.2rem',
                    fontWeight: 'bold',
                    color: '#15803d',
                    margin: '1rem 0',
                  }}
                >
                  <span>JUMLAH:</span>
                  <span>RM {posTotal.toFixed(2)}</span>
                </div>
                <input
                  type="text"
                  placeholder="Nama Pelanggan (Pilihan)"
                  value={posCustName}
                  onChange={(e) => setPosCustName(e.target.value)}
                  style={{
                    width: '94%',
                    padding: '0.5rem',
                    marginBottom: '0.8rem',
                  }}
                />
                <div
                  style={{
                    display: 'flex',
                    gap: '0.8rem',
                    marginBottom: '0.8rem',
                    fontSize: '0.9rem',
                  }}
                >
                  <label>
                    <input
                      type="radio"
                      checked={posPayMethod === 'cash'}
                      onChange={() => setPosPayMethod('cash')}
                    />{' '}
                    Tunai (Cash)
                  </label>
                  <label>
                    <input
                      type="radio"
                      checked={posPayMethod === 'duitnow_qr'}
                      onChange={() => setPosPayMethod('duitnow_qr')}
                    />{' '}
                    DuitNow QR
                  </label>
                </div>

                {posPayMethod === 'duitnow_qr' && storeInfo.payment_qr_url && (
                  <div
                    style={{
                      textAlign: 'center',
                      background: 'white',
                      padding: '0.8rem',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      marginBottom: '0.8rem',
                    }}
                  >
                    <small
                      style={{
                        display: 'block',
                        fontWeight: 'bold',
                        marginBottom: '0.4rem',
                        color: '#15803d',
                      }}
                    >
                      Tunjukkan QR kepada Pelanggan:
                    </small>
                    <img
                      src={storeInfo.payment_qr_url}
                      alt="DuitNow QR POS"
                      style={{
                        width: '180px',
                        height: 'auto',
                        borderRadius: '4px',
                      }}
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={processingPos}
                  style={{
                    width: '100%',
                    padding: '0.8rem',
                    background: '#15803d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                  }}
                >
                  {processingPos
                    ? 'Memproses...'
                    : 'Selesai Bayaran & Tolak Stok'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: LAPORAN JUALAN & UNTUNG KASAR HARIAN */}
      {activeTab === 'report' && (
        <div style={{ marginTop: '1.5rem' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.8rem',
            }}
          >
            <h3 style={{ margin: 0 }}>
              Ringkasan Jualan & Untung Kasar Harian
            </h3>
            <div>
              <label style={{ fontSize: '0.85rem', marginRight: '0.5rem' }}>
                Pilih Tarikh:
              </label>
              <input
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                style={{
                  padding: '0.4rem',
                  borderRadius: '4px',
                  border: '1px solid #ccc',
                }}
              />
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem',
              marginTop: '1rem',
            }}
          >
            <div
              style={{
                padding: '1.2rem',
                borderRadius: '8px',
                background: '#f0fdf4',
                border: '1px solid #86efac',
              }}
            >
              <div style={{ fontSize: '0.85rem', color: '#166534' }}>
                Jumlah Jualan Kasar ({dailySalesOrders.length} pesanan)
              </div>
              <div
                style={{
                  fontSize: '1.6rem',
                  fontWeight: 'bold',
                  color: '#15803d',
                  marginTop: '0.3rem',
                }}
              >
                RM {dailyRevenue.toFixed(2)}
              </div>
            </div>
            <div
              style={{
                padding: '1.2rem',
                borderRadius: '8px',
                background: '#fefce8',
                border: '1px solid #fde047',
              }}
            >
              <div style={{ fontSize: '0.85rem', color: '#854d0e' }}>
                Anggaran Kos Modal Produk
              </div>
              <div
                style={{
                  fontSize: '1.6rem',
                  fontWeight: 'bold',
                  color: '#a16207',
                  marginTop: '0.3rem',
                }}
              >
                RM {dailyCost.toFixed(2)}
              </div>
            </div>
            <div
              style={{
                padding: '1.2rem',
                borderRadius: '8px',
                background: '#eff6ff',
                border: '1px solid #93c5fd',
              }}
            >
              <div style={{ fontSize: '0.85rem', color: '#1e40af' }}>
                Untung Kasar Harian
              </div>
              <div
                style={{
                  fontSize: '1.6rem',
                  fontWeight: 'bold',
                  color: '#1d4ed8',
                  marginTop: '0.3rem',
                }}
              >
                RM {dailyGrossProfit.toFixed(2)}
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: '1.2rem',
              padding: '1rem',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              display: 'flex',
              gap: '2rem',
              fontSize: '0.95rem',
            }}
          >
            <div>
              🖥️ Jualan Kaunter POS: <strong>RM {posRevenue.toFixed(2)}</strong>
            </div>
            <div>
              🌐 Jualan Tempahan Web:{' '}
              <strong>RM {webRevenue.toFixed(2)}</strong>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: STOK, BATCH & REKOD ROSAK/BASI (WASTAGE) */}
      {activeTab === 'stock' && (
        <div>
          <div style={{ marginTop: '1.5rem' }}>
            <h3 style={{ marginBottom: '0.5rem' }}>Baki Stok Semasa</h3>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: '0.8rem',
              }}
            >
              {variantsList.map((v) => (
                <div
                  key={v.id}
                  style={{
                    padding: '1rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    background:
                      v.quantity_on_hand <= v.min_stock_level
                        ? '#fef2f2'
                        : '#ffffff',
                  }}
                >
                  <div style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>
                    {v.product_name}
                  </div>
                  <div style={{ color: '#666', fontSize: '0.85rem' }}>
                    {v.label}
                  </div>
                  <div
                    style={{
                      fontSize: '1.4rem',
                      fontWeight: 'bold',
                      marginTop: '0.4rem',
                      color: v.quantity_on_hand > 0 ? '#15803d' : '#dc2626',
                    }}
                  >
                    {v.quantity_on_hand}{' '}
                    <span style={{ fontSize: '0.9rem', fontWeight: 'normal' }}>
                      {v.units?.code}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '1rem',
              marginTop: '1.5rem',
            }}
          >
            <div
              style={{
                padding: '1rem',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
              }}
            >
              <h3 style={{ marginTop: 0 }}>+ Rekod Stok Masuk / Perahan</h3>
              <form
                onSubmit={handleReceiveStock}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.7rem',
                }}
              >
                <select
                  value={selVariantId}
                  onChange={(e) => setSelVariantId(e.target.value)}
                  required
                  style={{ padding: '0.5rem' }}
                >
                  {variantsList.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.product_name} — {v.label} ({v.units?.code})
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="No. Batch"
                  value={batchNo}
                  onChange={(e) => setBatchNo(e.target.value)}
                  required
                  style={{ padding: '0.5rem' }}
                />
                <input
                  type="number"
                  step="0.001"
                  placeholder="Kuantiti Masuk"
                  value={qtyReceived}
                  onChange={(e) => setQtyReceived(e.target.value)}
                  required
                  style={{ padding: '0.5rem' }}
                />
                <div>
                  <small
                    style={{
                      display: 'block',
                      color: '#666',
                      fontSize: '0.75rem',
                    }}
                  >
                    Tarikh Luput (Expiry Date):
                  </small>
                  <input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    style={{ width: '94%', padding: '0.45rem' }}
                  />
                </div>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Kos Seunit RM (Pilihan)"
                  value={batchCost}
                  onChange={(e) => setBatchCost(e.target.value)}
                  style={{ padding: '0.5rem' }}
                />
                <input
                  type="text"
                  placeholder="Catatan / Pembekal (Pilihan)"
                  value={supplierNote}
                  onChange={(e) => setSupplierNote(e.target.value)}
                  style={{ padding: '0.5rem' }}
                />
                <button
                  type="submit"
                  style={{
                    padding: '0.7rem',
                    background: '#15803d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                  }}
                >
                  Simpan Stok Masuk
                </button>
              </form>
            </div>

            <div
              style={{
                padding: '1rem',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                background: '#fef2f2',
              }}
            >
              <h3 style={{ marginTop: 0, color: '#991b1b' }}>
                ⚠️ Tolak Stok Rosak / Basi
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#7f1d1d', marginTop: 0 }}>
                Gunakan borang ini jika santan basi, pecah, atau rosak supaya
                tidak dikira sebagai jualan.
              </p>
              <form
                onSubmit={handleRecordWastage}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.7rem',
                }}
              >
                <select
                  value={wasteVariantId}
                  onChange={(e) => setWasteVariantId(e.target.value)}
                  required
                  style={{ padding: '0.5rem' }}
                >
                  {variantsList.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.product_name} — {v.label} (Baki: {v.quantity_on_hand})
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.001"
                  placeholder="Kuantiti Rosak / Basi"
                  value={wasteQty}
                  onChange={(e) => setWasteQty(e.target.value)}
                  required
                  style={{ padding: '0.5rem' }}
                />
                <input
                  type="text"
                  placeholder="Sebab (cth: Santan masam / plastik bocor)"
                  value={wasteReason}
                  onChange={(e) => setWasteReason(e.target.value)}
                  required
                  style={{ padding: '0.5rem' }}
                />
                <button
                  type="submit"
                  style={{
                    padding: '0.7rem',
                    background: '#dc2626',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                  }}
                >
                  Rekod Stok Rosak
                </button>
              </form>
            </div>
          </div>

          <div style={{ marginTop: '1.5rem' }}>
            <h3>Rekod Batch Terkini</h3>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.85rem',
              }}
            >
              <thead>
                <tr
                  style={{
                    background: '#f9fafb',
                    textAlign: 'left',
                    borderBottom: '2px solid #e5e7eb',
                  }}
                >
                  <th style={{ padding: '0.6rem' }}>No. Batch</th>
                  <th style={{ padding: '0.6rem' }}>Produk</th>
                  <th style={{ padding: '0.6rem' }}>Baki / Masuk</th>
                  <th style={{ padding: '0.6rem' }}>Tarikh Luput</th>
                  <th style={{ padding: '0.6rem' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '0.6rem', fontWeight: 'bold' }}>
                      {b.batch_number}
                    </td>
                    <td style={{ padding: '0.6rem' }}>
                      {b.product_variants?.products?.name} (
                      {b.product_variants?.label})
                    </td>
                    <td style={{ padding: '0.6rem' }}>
                      <strong>{b.quantity_remaining}</strong> /{' '}
                      {b.quantity_received} {b.product_variants?.units?.code}
                    </td>
                    <td style={{ padding: '0.6rem' }}>
                      {b.expiry_date || '-'}
                    </td>
                    <td style={{ padding: '0.6rem' }}>{b.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: TETAPAN KEDAI, QR CODE, KATALOG & HARGA */}
      {activeTab === 'catalogue' && (
        <div>
          <div
            style={{
              marginTop: '1.5rem',
              padding: '1rem',
              border: '1px solid #86efac',
              borderRadius: '8px',
              background: '#f0fdf4',
            }}
          >
            <h3 style={{ marginTop: 0, color: '#166534' }}>
              ⚙️ Tetapan Kedai, Caj Delivery & DuitNow QR
            </h3>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const addrVal = (
                  document.getElementById('pickupAddrInput') as HTMLInputElement
                ).value;
                const hoursVal = (
                  document.getElementById('opHoursInput') as HTMLInputElement
                ).value;
                const feeVal = (
                  document.getElementById('feeKmInput') as HTMLInputElement
                ).value;

                const { error } = await supabase.from('settings').upsert(
                  [
                    { key: 'pickup_address', value: addrVal },
                    { key: 'operating_hours', value: hoursVal },
                    { key: 'delivery_fee_per_km', value: Number(feeVal) },
                  ],
                  { onConflict: 'key' }
                );

                if (error) setMsg('Ralat tetapan: ' + error.message);
                else {
                  setMsg(
                    '✅ Tetapan alamat, waktu operasi & caj penghantaran berjaya dikemas kini!'
                  );
                  fetchStorefront();
                }
              }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.7rem',
              }}
            >
              <div>
                <small style={{ display: 'block', color: '#166534' }}>
                  Alamat Pickup Kedai:
                </small>
                <input
                  id="pickupAddrInput"
                  type="text"
                  defaultValue={
                    storeInfo.pickup_address || 'UTC Keramat, Kuala Lumpur'
                  }
                  required
                  style={{ width: '96%', padding: '0.5rem' }}
                />
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.5fr 1fr',
                  gap: '0.6rem',
                }}
              >
                <div>
                  <small style={{ display: 'block', color: '#166534' }}>
                    Waktu Operasi:
                  </small>
                  <input
                    id="opHoursInput"
                    type="text"
                    defaultValue={storeInfo.operating_hours || 'Setiap hari'}
                    required
                    style={{ width: '94%', padding: '0.5rem' }}
                  />
                </div>
                <div>
                  <small style={{ display: 'block', color: '#166534' }}>
                    Kadar Delivery (RM / km):
                  </small>
                  <input
                    id="feeKmInput"
                    type="number"
                    step="0.10"
                    defaultValue={storeInfo.delivery_fee_per_km || '1.00'}
                    required
                    style={{ width: '92%', padding: '0.5rem' }}
                  />
                </div>
              </div>
              <button
                type="submit"
                style={{
                  padding: '0.6rem 1rem',
                  background: '#15803d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  alignSelf: 'start',
                }}
              >
                Simpan Tetapan Kedai
              </button>
            </form>

            {/* RUANGAN MUAT NAIK GAMBAR QR CODE */}
            <div
              style={{
                marginTop: '1rem',
                paddingTop: '0.8rem',
                borderTop: '1px dashed #86efac',
              }}
            >
              <small
                style={{
                  display: 'block',
                  color: '#166534',
                  fontWeight: 'bold',
                  marginBottom: '0.4rem',
                }}
              >
                Gambar DuitNow QR Pembayaran (JPG / PNG):
              </small>
              <input
                type="file"
                accept="image/*"
                onChange={handleUploadQr}
                style={{ fontSize: '0.85rem' }}
              />
              {storeInfo.payment_qr_url && (
                <div style={{ marginTop: '0.6rem' }}>
                  <img
                    src={storeInfo.payment_qr_url}
                    alt="Pratonton QR"
                    style={{
                      width: '120px',
                      borderRadius: '6px',
                      border: '1px solid #ccc',
                      background: 'white',
                      padding: '4px',
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          <div
            style={{
              marginTop: '1.5rem',
              padding: '1rem',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
            }}
          >
            <h3 style={{ marginTop: 0 }}>1. Kategori Produk</h3>
            <form
              onSubmit={handleAddCategory}
              style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}
            >
              <input
                type="text"
                placeholder="Contoh: Santan Segar, Kelapa Parut"
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                style={{ flex: 1, padding: '0.5rem' }}
              />
              <button
                type="submit"
                style={{
                  padding: '0.5rem 1rem',
                  background: '#15803d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                + Kategori
              </button>
            </form>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {categories.map((c) => (
                <span
                  key={c.id}
                  style={{
                    background: '#f3f4f6',
                    padding: '0.3rem 0.7rem',
                    borderRadius: '12px',
                    fontSize: '0.85rem',
                  }}
                >
                  {c.name}
                </span>
              ))}
            </div>
          </div>

          <div
            style={{
              marginTop: '1.5rem',
              padding: '1rem',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
            }}
          >
            <h3 style={{ marginTop: 0 }}>2. Tambah Produk & Harga Jualan</h3>
            <form
              onSubmit={handleAddProduct}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0.8rem',
              }}
            >
              <input
                type="text"
                placeholder="Nama Produk"
                value={prodName}
                onChange={(e) => setProdName(e.target.value)}
                required
                style={{ padding: '0.5rem' }}
              />
              <select
                value={prodCatId}
                onChange={(e) => setProdCatId(e.target.value)}
                style={{ padding: '0.5rem' }}
              >
                <option value="">-- Pilih Kategori --</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Keterangan ringkas"
                value={prodDesc}
                onChange={(e) => setProdDesc(e.target.value)}
                style={{ gridColumn: '1 / -1', padding: '0.5rem' }}
              />
              <input
                type="text"
                placeholder="Label Pek / Saiz (cth: Pek 1kg)"
                value={varLabel}
                onChange={(e) => setVarLabel(e.target.value)}
                required
                style={{ padding: '0.5rem' }}
              />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="number"
                  step="0.001"
                  placeholder="Kuantiti"
                  value={sizeQty}
                  onChange={(e) => setSizeQty(e.target.value)}
                  style={{ width: '60%', padding: '0.5rem' }}
                />
                <select
                  value={unitId}
                  onChange={(e) => setUnitId(e.target.value)}
                  style={{ width: '40%', padding: '0.5rem' }}
                >
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.code}
                    </option>
                  ))}
                </select>
              </div>
              <input
                type="number"
                step="0.01"
                placeholder="Harga Jualan RM"
                value={sellPrice}
                onChange={(e) => setSellPrice(e.target.value)}
                required
                style={{ padding: '0.5rem' }}
              />
              <input
                type="number"
                step="0.01"
                placeholder="Harga Modal RM"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                style={{ padding: '0.5rem' }}
              />
              <button
                type="submit"
                style={{
                  gridColumn: '1 / -1',
                  padding: '0.7rem',
                  background: '#15803d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                }}
              >
                Simpan Produk
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
