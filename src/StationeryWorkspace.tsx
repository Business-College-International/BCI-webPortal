import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { api, CurrentUser } from './api/client';

type CatalogItem = { id: string; sku: string; name: string; price: string; stockQty: number; isActive: boolean };
type Order = { id: string; orderNumber: string; studentId: string; guardianId: string; status: string; totalAmount: string; paymentId: string | null; orderedAt: string; fulfilledAt: string | null; collectedAt: string | null; lines: Array<{ quantity: number; unitPrice: string; lineTotal: string; item: { sku: string; name: string } }> };

async function listCatalog(): Promise<CatalogItem[]> { const response = await api.get<CatalogItem[]>('/stationery/catalog'); return response.data; }
async function createOrder(input: { studentId: string; lines: Array<{ itemId: string; quantity: number }> }): Promise<Order> { const response = await api.post<Order>('/stationery/orders', input); return response.data; }
async function listMyOrders(): Promise<Order[]> { const response = await api.get<Order[]>('/stationery/orders/me'); return response.data; }
async function listOrders(status?: string): Promise<Order[]> { const response = await api.get<Order[]>('/stationery/operations/orders', { params: status ? { status } : undefined }); return response.data; }
async function markReady(id: string) { const response = await api.patch<Order>(`/stationery/operations/orders/${encodeURIComponent(id)}/ready`); return response.data; }
async function markCollected(id: string) { const response = await api.patch<Order>(`/stationery/operations/orders/${encodeURIComponent(id)}/collected`); return response.data; }
async function cancelDraft(id: string) { const response = await api.patch<Order>(`/stationery/operations/orders/${encodeURIComponent(id)}/cancel`); return response.data; }

export function GuardianStationeryWorkspace({ currentUser, wards }: { currentUser: CurrentUser; wards: Array<{ id: string; firstName: string; lastName: string; canPayFees: boolean }> }) {
  const enabled = currentUser.roles.includes('GUARDIAN');
  const queryClient = useQueryClient();
  const catalog = useQuery({ queryKey: ['stationery-catalog'], queryFn: listCatalog, enabled });
  const orders = useQuery({ queryKey: ['stationery-my-orders'], queryFn: listMyOrders, enabled });
  const [studentId, setStudentId] = useState('');
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const eligibleWards = wards.filter((ward) => ward.canPayFees);
  const cart = useMemo(() => Object.entries(quantities).filter(([, quantity]) => quantity > 0).map(([itemId, quantity]) => ({ itemId, quantity })), [quantities]);
  const estimatedTotal = useMemo(() => catalog.data?.reduce((sum, item) => sum + (quantities[item.id] ?? 0) * Number(item.price), 0) ?? 0, [catalog.data, quantities]);
  const orderMutation = useMutation({ mutationFn: createOrder, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['stationery-my-orders'] }); setQuantities({}); } });

  if (!enabled) return null;
  return <section className="card">
    <div className="section-heading"><div><p className="eyebrow">School store</p><h2>Stationery</h2><p className="muted">Prepare a stationery order for a ward. Payment and fulfillment are separate controlled steps.</p></div></div>
    <label>Ward<select value={studentId} onChange={(e) => setStudentId(e.target.value)}><option value="">Select a ward</option>{eligibleWards.map((ward) => <option key={ward.id} value={ward.id}>{ward.firstName} {ward.lastName}</option>)}</select></label>
    {eligibleWards.length === 0 && <p>No ward currently has stationery purchasing permission.</p>}
    {catalog.isFetching && <p>Loading stationery catalogue…</p>}
    {catalog.data && <div className="table-wrap"><table><thead><tr><th>Item</th><th>Price</th><th>Stock</th><th>Quantity</th></tr></thead><tbody>{catalog.data.filter((item) => item.stockQty > 0).map((item) => <tr key={item.id}><td>{item.name} · {item.sku}</td><td>GHS {Number(item.price).toFixed(2)}</td><td>{item.stockQty}</td><td><input aria-label={`Quantity for ${item.name}`} type="number" min="0" max={item.stockQty} value={quantities[item.id] ?? 0} onChange={(e) => setQuantities({ ...quantities, [item.id]: Math.min(item.stockQty, Math.max(0, Number(e.target.value) || 0)) })} /></td></tr>)}</tbody></table></div>}
    <div className="detail-grid"><span><strong>Cart items</strong>{cart.reduce((sum, line) => sum + line.quantity, 0)}</span><span><strong>Estimated total</strong>GHS {estimatedTotal.toFixed(2)}</span></div>
    <button disabled={!studentId || cart.length === 0 || orderMutation.isPending} onClick={() => orderMutation.mutate({ studentId, lines: cart })}>{orderMutation.isPending ? 'Creating…' : 'Create draft order'}</button>
    {orderMutation.isError && <p role="alert">The stationery order could not be created.</p>}
    <h3>My stationery orders</h3>
    {orders.isFetching && <p>Loading order history…</p>}
    {orders.data?.length === 0 && <p>No stationery orders yet.</p>}
    {orders.data?.map((order) => <article className="card nested-card" key={order.id}><div className="section-heading"><div><strong>{order.orderNumber}</strong><p className="muted">{order.status} · GHS {Number(order.totalAmount).toFixed(2)}</p></div><small>{new Date(order.orderedAt).toLocaleString()}</small></div><p>{order.lines.map((line) => `${line.quantity} × ${line.item.name}`).join(' · ')}</p>{order.status === 'DRAFT' && <p className="muted">Waiting for payment before the school can fulfill this order.</p>}</article>)}
  </section>;
}

export function StationeryOperationsWorkspace({ currentUser }: { currentUser: CurrentUser }) {
  const enabled = currentUser.permissions.includes('inventory.read');
  const queryClient = useQueryClient();
  const orders = useQuery({ queryKey: ['stationery-operations-orders'], queryFn: () => listOrders(), enabled });
  const ready = useMutation({ mutationFn: markReady, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['stationery-operations-orders'] }) });
  const collected = useMutation({ mutationFn: markCollected, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['stationery-operations-orders'] }) });
  const cancel = useMutation({ mutationFn: cancelDraft, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['stationery-operations-orders'] }) });
  if (!enabled) return null;
  return <section className="card"><div className="section-heading"><div><p className="eyebrow">Inventory operations</p><h2>Stationery Fulfillment</h2><p className="muted">Stock leaves inventory only when a successful stationery payment is linked to a paid order.</p></div></div>
    {orders.isFetching && <p>Loading stationery orders…</p>}
    {orders.data?.length === 0 && <p>No stationery orders.</p>}
    {orders.data && <div className="table-wrap"><table><thead><tr><th>Order</th><th>Ward</th><th>Status</th><th>Total</th><th>Actions</th></tr></thead><tbody>{orders.data.map((order) => <tr key={order.id}><td>{order.orderNumber}</td><td>{order.studentId}</td><td>{order.status}</td><td>GHS {Number(order.totalAmount).toFixed(2)}</td><td>{order.status === 'DRAFT' && <button className="secondary" disabled={cancel.isPending} onClick={() => cancel.mutate(order.id)}>Cancel</button>}{order.status === 'PAID' && <button disabled={ready.isPending} onClick={() => ready.mutate(order.id)}>Fulfill</button>}{order.status === 'READY_FOR_COLLECTION' && <button disabled={collected.isPending} onClick={() => collected.mutate(order.id)}>Mark collected</button>}</td></tr>)}</tbody></table></div>}
    {(ready.isError || collected.isError || cancel.isError) && <p role="alert">The stationery operation was rejected by the server.</p>}
  </section>;
}
