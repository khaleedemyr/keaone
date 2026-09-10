# QA Findings — Modul Procurement (KeaOne)

**Tanggal review:** 8 September 2026  
**Terakhir di-fix:** 8 September 2026  
**Metode:** Static code review (backend + frontend), bukti dari source  
**Scope:** Modul `purchase` / pengadaan — PR → PO → GR → retur → AP/match → payment → planning  
**Bukan:** Runtime E2E / load test di environment produksi

---

## Status perbaikan (2026-09-08)

| ID | Status | Catatan singkat |
|----|--------|-----------------|
| A1–A3 | **Fixed** | Re-cek status under lock; blok confirm bila PO closed/cancelled; update kondisional |
| A4 | **Fixed** | `acted_at => now()` |
| A5 | **Fixed** | Match qty kumulatif dalam **base unit** + sisa tagihan |
| A6 | **Fixed** | Re-cek status + conditional update pada pay batch/prepayment |
| A7 | **Fixed** | `POST /purchase-orders/batch` atomic + UI pakai batch |
| B1 | **Fixed** | Submit tanpa approval → `approved`; order commit budget dari draft |
| B2–B3 | **Fixed** | GR wajib link baris PO; supplier dipaksa dari PO; sisa qty base unit |
| B4 | **Fixed** | Cap qty PO vs PR (base); `for_po` abaikan PO cancelled |
| B5 | **Fixed** | Cancel/close/approve dengan lock + re-check |
| B6–B8 | **Fixed** | Validasi supplier/PO UI; landed cost error terpisah; PO picker `ordered,partial,received` |
| B9 | **Fixed** | `payableTotal` hormati 0 bila ada WHT |
| B10 | **Fixed** | Prepayment pay/apply post GL + WHT record |
| B11–B12 | **Fixed** | GRNI fail-closed; ownership baris PO/GR di invoice |
| C1 | **Fixed** | `applyPoReceiveDelta` tanpa `round()` — akumulasi base + floor ke satuan PO |
| C2 | **Fixed** | `purchase_update_cost` dihormati via `InventoryService::adjust(..., syncProductCost)` |
| C3 | **Fixed** | `assertProductPurchasable` di PR/PO/GR |
| C5–C6 | **Fixed** | Notify semua parallel; level non-aktif = `waiting` |
| C7 | **Fixed** | SoD cek `approved_by` header |
| C8 | **Fixed** | `DocumentSequenceService` + tabel `company_document_sequences` |
| C9–C10 | **Fixed** | Search match exception; hide Create PO tanpa permission |
| C13 | **Fixed** | Status dashboard lengkap |
| C14 | **Fixed** | Quote submit/save tolak unit cost ≤ 0 |
| C15 | **Fixed** | Retur cap vs GR base qty |
| C16 | **Fixed** | `BudgetService::assertAvailable` lockForUpdate |
| C17 | **Fixed** | Match harga pakai net unit cost (setelah discount) / base |
| C18 | **Fixed** | Waive wajib note ≥5 + SoD vs pembuat invoice |
| C19 | **Fixed** | Portal invoice → draft bila approval on |
| C20 | **Fixed** | Unique source GL + re-check under lock |
| D1 | **Fixed** | Asset register per base qty + cost per base |
| D2 | **Fixed** | Roadmap maturity + gap table diselaraskan |
| D3 | **Fixed** | Filter `cancelled` + toast bila tidak ada qty release |
| D4 | **Fixed** | Error aksi portal dipisah dari load |
| D5 | **Fixed** | Opsi kosong PO/GR = `purchaseSelectPo` / `purchaseSelectGr` |

**Unit conversion:** GR↔PO, match invoice, retur, dan asset memakai `ProductUnitService::toBaseQty` / `fromBaseQtyFloor` / `netUnitCost` agar lintas satuan (pcs/box) tidak hilang karena `round()`.

---

## Ringkasan eksekutif

Modul procurement sudah sangat luas (Fase 1–7 di roadmap banyak bertanda ✅). Temuan critical/high/medium/low dari review **sudah ditutup** pada sesi fix 8 Sep 2026.

| Severity | Awal | Fixed | Masih open |
|----------|------|-------|------------|
| Critical | 7 | 7 | 0 |
| High | 12 | 12 | 0 |
| Medium/Low | 19 | 19 | 0 |

---

## A. Critical

### A1. Double confirm GR → stok dobel
| | |
|---|---|
| **Area** | Backend — GR |
| **File** | `app/Services/PurchaseService.php` → `confirmReceipt` (~850–953) |
| **Temuan** | Status `draft` dicek **sebelum** transaksi. Setelah `lockForUpdate()`, status **tidak** dicek ulang. |
| **Dampak** | Dua request concurrent `POST …/confirm` keduanya bisa men-adjust stok → layer/cost dobel. |
| **Repro** | Buat GR draft → kirim 2 confirm paralel (tab/API). |
| **Saran** | Setelah lock: abort kecuali `status === 'draft'`; atau `UPDATE … WHERE status='draft'` harus affect 1 row. |

### A2. Double void GR → stok terbalik dua kali
| | |
|---|---|
| **Area** | Backend — GR reversal |
| **File** | `PurchaseService::voidReceipt` (~966–1049) |
| **Temuan** | Pola TOCTOU sama: cek `confirmed` di luar, tidak re-validasi di dalam lock. |
| **Dampak** | Stok negatif / understated `qty_received`, GL reverse ganda. |
| **Saran** | Re-assert `confirmed` under lock; conditional update ke `voided`. |

### A3. Confirm GR setelah PO closed/cancelled masih posting stok
| | |
|---|---|
| **Area** | Backend — GR + PO lifecycle |
| **File** | `confirmReceipt`, `refreshPoStatus` (~2020–2024), `closeOrder` / `cancelOrder` |
| **Temuan** | Status PO dicek saat **buat** GR (`ordered`/`partial`), bukan saat **confirm**. `refreshPoStatus` early-return jika PO `closed`/`cancelled` → header stuck, line `qty_received` tetap naik. |
| **Dampak** | Barang masuk gudang padahal PO sudah ditutup/dibatalkan. |
| **Repro** | PO ordered → GR draft → close/cancel PO → confirm GR. |
| **Saran** | Under lock: PO harus masih `ordered`/`partial`; atau blok close/cancel bila ada GR draft. |

### A4. Reject vendor invoice crash saat ada approval
| | |
|---|---|
| **Area** | Backend — AP |
| **File** | `VendorInvoiceService::reject` (~280) |
| **Temuan** | `'acted_at' => now` (konstanta PHP), seharusnya `now()`. Service prepayment/batch sudah benar. |
| **Dampak** | Reject invoice dengan approval rows gagal (PHP 8+ undefined constant) — workflow reject rusak. |
| **Saran** | Ganti ke `now()`. |

### A5. 3-way match qty bandingkan ke qty GR penuh (bukan sisa tagihan)
| | |
|---|---|
| **Area** | Backend — Matching |
| **File** | `ProcurementMatchService::match` (~66–106) |
| **Temuan** | Cek 1:1 `invoice.qty` vs `grItem.qty` / `poItem.qty`. Tidak ada qty kumulatif invoice sebelumnya, tidak normalisasi `factor_to_base`. |
| **Dampak** | Partial invoice selalu exception (kecuali toleransi besar); sekaligus beberapa invoice ≤ qty GR bisa semua “match” → overbill. |
| **Saran** | Bandingkan vs **remaining invoiceable base qty**; blok jika kumulatif melebihi GR/PO ± toleransi. |

### A6. Concurrent `pay()` bisa double-pay
| | |
|---|---|
| **Area** | Backend — Payment / Prepayment |
| **File** | `VendorPaymentBatchService::pay`, `VendorPrepaymentService::pay` |
| **Temuan** | Status divalidasi sebelum lock; tidak di-recheck setelah `lockForUpdate()`. |
| **Dampak** | `amount_paid` naik dua kali; jurnal mungkin tertahan `hasPosted`, tapi data operasional AP/cash salah. |
| **Saran** | Setelah lock, assert status; conditional status update. |

### A7. Multi-supplier PO dari PR — partial success tanpa rollback
| | |
|---|---|
| **Area** | Frontend — PR → PO |
| **File** | `frontend/src/pages/purchase/ApprovedPrPoBoard.tsx` (~311–330) |
| **Temuan** | Loop `api.post('/purchase-orders')` per supplier tanpa transaksi/kompensasi. Error di tengah → sebagian PO sudah tercipta. |
| **Dampak** | Orphan PO, retry bisa duplikat; PR state “for PO” inkonsisten. |
| **Saran** | Endpoint batch backend 1 transaksi, atau tampilkan supplier mana yang sukses + blok blind retry. |

---

## B. High

### B1. `markOrdered` bypass budget saat approval off
| | |
|---|---|
| **File** | `PurchaseService::orderPurchaseOrder` (~743–762) vs `submitOrder` + `BudgetService::commitForPoSubmit` |
| **Temuan** | Tanpa `po_need_approval`, path umum `draft → ordered` tidak lewat `submitOrder` → budget commit tidak jalan. Status `submitted` juga tidak masuk allowed list. |
| **Dampak** | Fitur budget check (roadmap ✅) bisa dilompati. |
| **Saran** | Saat approval off: submit langsung `approved`, atau commit budget pada transisi ke `ordered`. |

### B2. Baris GR tidak dikunci ke baris PO
| | |
|---|---|
| **File** | `attachGrItems` (~1983–2017), `confirmReceipt` (~920–937) |
| **Temuan** | Tidak cek `purchase_order_item_id` milik PO yang sama / `product_id` cocok. Baris tanpa link PO tetap menambah stok tanpa update `qty_received`. |
| **Dampak** | Over-receive tersembunyi; PO tetap open padahal stok sudah penuh. |
| **Saran** | Wajib link ke item PO bila ada `purchase_order_id`; validasi sisa qty termasuk GR draft lain. |

### B3. Supplier GR bisa beda dari PO
| | |
|---|---|
| **File** | `writeReceipt` / `updateReceipt` |
| **Temuan** | `supplier_id` dari payload tidak dipaksa sama dengan `po.supplier_id`. |
| **Dampak** | Jejak AP/retur/report salah vendor. |
| **Saran** | Jika linked PO → force supplier dari PO. |

### B4. Qty PR → PO / multi-PO tidak ditegakkan
| | |
|---|---|
| **File** | `writeOrder`; `PurchaseRequisitionController::index` `for_po` |
| **Temuan** | Tidak ada cap qty PO vs PR. `for_po` memakai `whereDoesntHave('orders')` → PO **cancelled** mengunci PR selamanya dari UI. |
| **Dampak** | Over-buy vs PR, atau PR macet setelah PO batal. |
| **Saran** | Track remaining PR qty; izinkan PO baru jika tidak ada order aktif non-cancelled. |

### B5. Race approve / reject / cancel PR & PO
| | |
|---|---|
| **File** | `approveRequisition` / `cancelRequisition` / setara PO |
| **Temuan** | Gate status di luar transaksi; cancel sering tanpa `lockForUpdate`. |
| **Dampak** | Dokumen cancelled bisa jadi approved (atau sebaliknya); budget release/commit salah timing. |
| **Saran** | Lock + re-check status di semua transisi. |

### B6. UI GR: supplier tidak `required`; PO opsional
| | |
|---|---|
| **File** | `PurchaseDocs.tsx` (~1075, onSubmit ~484–507) |
| **Temuan** | `needsSupplier` termasuk `gr`, tapi `required={kind === 'po' \|\| kind === 'direct'}`. Validasi submit tidak cek `supplierId`/`poId`. |
| **Dampak** | GR tanpa supplier (dan tanpa PO di flow non-direct) merusak match/retur/report. Backend memang cek PO di confirm untuk non-direct — UX tetap menyesatkan. |
| **Saran** | Client-validate supplier; wajib `poId` jika flow ≠ `direct`. |

### B7. Landed cost gagal setelah GR tersimpan
| | |
|---|---|
| **File** | `PurchaseDocs.tsx` (~529–568) |
| **Temuan** | Create GR sukses lalu `PUT …/landed-cost`; satu try/catch — gagal landed cost tampil `saveFailed` padahal GR sudah ada. |
| **Dampak** | Retry create → GR duplikat; cost tidak lengkap. |
| **Saran** | Pisahkan pesan “GR tersimpan, landed cost gagal”; disable create ulang. |

### B8. Picker PO invoice hanya `status=ordered`
| | |
|---|---|
| **File** | `VendorInvoiceDocs.tsx` (~210–212, `fillFromPo` ~343–350) |
| **Temuan** | PO `partial` hilang dari dropdown. `fillFromPo` memakai `qty_remaining` (sisa terima), bukan sisa tagih. |
| **Dampak** | Setelah partial GR, user sulit buat invoice 3-way; qty invoice salah. |
| **Saran** | Load `ordered`+`partial`(+`received`); prefer fill from GR; API invoiceable qty. |

### B9. `amount_payable = 0` dianggap “belum diisi”
| | |
|---|---|
| **File** | `VendorInvoice::payableTotal` (~115–119) |
| **Temuan** | `$payable > 0 ? $payable : total` — WHT ≈ 100% membuat due kembali ke `total`. |
| **Dampak** | Overpay cash vs payable sebenarnya. |
| **Saran** | Bedakan `null` (unset) vs `0` (benar-benar nol). |

### B10. Prepayment apply tanpa WHT / GL
| | |
|---|---|
| **File** | `VendorPrepaymentService::apply` vs payment batch |
| **Temuan** | Apply hanya naikkan `amount_paid`/`amount_applied`; tidak record PPh / jurnal. |
| **Dampak** | Buku AP/cash/WHT tidak lengkap saat settle via DP. |
| **Saran** | Post GL + alokasi WHT pada apply/pay prepayment. |

### B11. Invoice GL tanpa mapping GRNI → double expense/inventory
| | |
|---|---|
| **File** | `GlPostingService::postVendorInvoice` |
| **Temuan** | Jika ada `goods_receipt_id` tapi `map['grni']` kosong, jatuh ke cabang non-GR (Dr inventory/expense). |
| **Dampak** | Double recognition; GRNI tidak clear. |
| **Saran** | Fail-closed: GR linked wajib mapping GRNI. |

### B12. Link PO/GR item di invoice tanpa ownership check
| | |
|---|---|
| **File** | `VendorInvoiceService::attachItems`, `ProcurementMatchService::match` |
| **Temuan** | ID baris diterima as-is; `find()` gagal → skip diam-diam; tidak cek belong-to header / product match. |
| **Dampak** | Cross-PO/GR “lolos” match. |
| **Saran** | Assert ownership + product di attach & match. |

---

## C. Medium

### C1. Konversi unit pakai `round(baseQty / poFactor)`
**File:** `confirmReceipt` / `voidReceipt` (~923–924, ~1023–1024)  
**Dampak:** Partial receive lintas satuan (pcs vs box) bisa jadi qty PO salah atau error “tidak cocok”.  
**Saran:** Akumulasi base qty; atau wajib satuan komensurabel.

### C2. Setting `purchase_update_cost` diabaikan untuk item stok
**File:** `confirmReceipt` + `CostingService::syncProductCost`  
**Dampak:** Toggle OFF di settings tetap update cost master untuk SKU `track_stock`.  
**Saran:** Hormati flag di path costing inbound.

### C3. API menerima produk non-procurement
**File:** `attachPrItems` / `attachPoItems` / `attachGrItems` vs filter UI `for_purchase`  
**Dampak:** Finished goods / non-buyable bisa dibeli via API.  
**Saran:** Shared eligibility assert di service.

### C4. Approval kosong / off → siapa saja dengan edit bisa approve
**File:** `approveRequisition` / `approveOrder`, serialize `can_approve`  
**Dampak:** Governance lemah; SoD hanya efektif jika chain tersinkron.  
**Saran:** Approval off → auto-approve on submit; jangan shortcut empty-chain.

### C5. Parallel approval: hanya approver pertama dinotifikasi
**File:** `notifyCurrentPrApprover` / `notifyCurrentPoApprover` (`firstWhere` level)  
**Dampak:** Roadmap parallel ✅ tapi notify incomplete.  
**Saran:** Notify semua pending di level aktif.

### C6. Submit menandai **semua** level approval sebagai pending
**File:** `markApprovalRowsPending` di submit PR/PO  
**Dampak:** UI/audit menyesatkan untuk level yang belum aktif.  
**Saran:** Hanya level 1 pending; sisanya `waiting`.

### C7. SoD receiver ≠ approver tidak lengkap
**File:** `ApprovalGovernanceService::assertReceiverNotPoApprover`; default `procurement_sod_approver_receiver = false`  
**Dampak:** Hanya cek row `status=approved`; abaikan `approved_by` header; default off.  
**Saran:** Sertakan `approved_by`; dokumentasikan default.

### C8. Race nomor dokumen
**File:** `nextNumber` (~2047+)  
**Dampak:** Concurrent create → unique violation / 500 intermittent.  
**Saran:** Sequence table / advisory lock / retry on unique.

### C9. Search match exception UI mati
**File:** `MatchExceptionDocs.tsx` — filter search tidak dikirim ke API  
**Dampak:** User mengira filter bekerja.  
**Saran:** Pass `search` atau hapus search box.

### C10. Tombol Create PO tampil tanpa permission create
**File:** `ApprovedPrPoBoard.tsx`  
**Dampak:** User view-only buka form lalu silent no-op.  
**Saran:** Hide/disable + error jelas.

### C11. Invoice / retur: aksi lifecycle tanpa konfirmasi
**File:** `VendorInvoiceDocs.tsx`, `PurchaseReturnDocs.tsx`  
**Dampak:** Accidental confirm/cancel/reject.  
**Saran:** `feedback.confirm` seperti di `PurchaseDocs`.

### C12. Pesan validasi menyesatkan (supplier vs items)
**File:** `VendorInvoiceDocs`, `PurchaseReturnDocs`  
**Dampak:** Error `purchaseNeedItems` padahal supplier/warehouse kosong.  
**Saran:** Branch pesan per field.

### C13. Status dashboard/list fallback ke “Draft”
**File:** `ProcurementDashboard.tsx` `STATUS_LABEL`  
**Dampak:** `rejected`/`cancelled`/`voided`/`closed` tampil sebagai Draft.  
**Saran:** Lengkapi map; unknown → raw status.

### C14. RFQ izinkan quote all-zero / RFQ kosong
**File:** `RfqDocs.tsx`  
**Dampak:** Harga 0 masuk PR/PO.  
**Saran:** Validasi item, supplier, unit cost > 0 (atau confirm eksplisit).

### C15. Retur: qty tidak dibatasi GR / tanpa GL AP
**File:** `ProcurementReturnService::confirm` / `attachItems`  
**Dampak:** Over-return; buku keuangan tidak ikut.  
**Saran:** Cap kumulatif ≤ received; post credit note/GL.

### C16. Budget commit tanpa row lock
**File:** `BudgetService::assertAvailable` / commit PR/PO  
**Dampak:** Concurrent submit over-commit.  
**Saran:** `lockForUpdate` pada budget line.

### C17. Match price abaikan discount / extended amount
**File:** `ProcurementMatchService` price branch  
**Dampak:** Manipulasi unit_cost + discount bypass kontrol harga.  
**Saran:** Bandingkan extended line amount.

### C18. Waive match exception terlalu mudah
**File:** `MatchExceptionController::waive`  
**Dampak:** Override finansial single-user permanen.  
**Saran:** Permission khusus / dual control; re-eval jika variance berubah.

### C19. Portal invoice bypass approval chain
**File:** `VendorInvoiceService::writeInvoiceFromPortal` + `approve`  
**Dampak:** Invoice portal `submitted` tanpa approval rows → auto-approve path.  
**Saran:** Sync approver default atau status khusus sampai internal submit.

### C20. GL idempotency hanya soft check
**File:** `GlPostingService::hasPosted` — index tanpa unique constraint  
**Dampak:** Race double journal.  
**Saran:** Unique `(company_id, source_type, source_id)` untuk posted.

---

## D. Low / dokumentasi & UX

### D1. Fixed-asset GR memakai `qty` line, bukan base unit
**File:** `AssetService::registerFromGrItem`  
2 box → 2 asset, bukan 24 unit fisik.

### D2. Roadmap inkonsisten
**File:** `docs/procurement-roadmap.md`  
Bagian fase ✅, tabel “Gap vs enterprise” di bawah masih ❌. Banyak fitur finance default **off** di `config/procurement.php` (`gr_reversal_enabled`, `vendor_invoice_enabled`, match, GL, budget, RFQ, dll.).

### D3. Contract filter tanpa `cancelled`; release PO silent
**File:** `ContractDocs.tsx`

### D4. Vendor portal: error confirm mirip “portal not found”
**File:** `PublicVendorPortalView.tsx` — state `error` digabung load vs action.

### D5. Label opsi kosong PO/GR invoice memakai `filterAll`
**File:** `VendorInvoiceDocs.tsx` — sebaiknya “Pilih…” / None.

---

## Matriks cakupan vs risiko bisnis

| Alur | Risiko utama | Severity puncak |
|------|--------------|-----------------|
| PR → PO | Qty tidak di-cap; multi-PO partial; PR stuck setelah cancel | High / Critical (UI) |
| PO → GR | Double confirm/void; receive setelah close; link line lemah | Critical |
| GR → Invoice match | Partial billing salah; overbill; waive mudah | Critical / High |
| Payment | Double pay; payable=0; prepayment tanpa GL/WHT | Critical / High |
| Approval / SoD | Race; empty chain; parallel notify; default SoD receiver off | High / Medium |
| Planning / contract / RFQ | Validasi tipis; UX silent fail | Medium / Low |
| Docs / settings | Roadmap ✅ vs default off & gap table usang | Low (tapi misleading) |

---

## Checklist uji manual yang disarankan (setelah fix)

- [ ] Confirm GR 2× paralel → hanya 1 sukses, stok +1×  
- [ ] Void GR 2× paralel → hanya 1 sukses  
- [ ] GR draft + close PO → confirm ditolak  
- [ ] Reject invoice dengan approval enabled → sukses, `acted_at` terisi  
- [ ] Invoice partial 50% lalu 50% → match tanpa exception; invoice 110% → exception  
- [ ] Pay batch 2× paralel → `amount_paid` tidak dobel  
- [ ] PR multi-supplier: gagal di supplier ke-2 → tidak ada PO setengah jadi (atau recovery jelas)  
- [ ] PO `partial` muncul di picker vendor invoice  
- [ ] GR form: tanpa supplier tidak bisa save  
- [ ] Invoice WHT 100% → due = 0, tidak fallback ke total  
- [ ] Dashboard: status cancelled/voided bukan “Draft”

---

## Referensi file kunci

| Area | Path |
|------|------|
| Core purchase | `backend/app/Services/PurchaseService.php` |
| Match | `backend/app/Services/ProcurementMatchService.php` |
| Vendor invoice | `backend/app/Services/VendorInvoiceService.php` |
| Payment / DP | `VendorPaymentBatchService.php`, `VendorPrepaymentService.php` |
| Return | `ProcurementReturnService.php` |
| Settings | `backend/config/procurement.php` |
| UI dokumen | `frontend/src/pages/purchase/PurchaseDocs.tsx` |
| PR→PO board | `ApprovedPrPoBoard.tsx` |
| Invoice UI | `VendorInvoiceDocs.tsx` |
| Roadmap | `backend/docs/procurement-roadmap.md` |

---

## Catatan metodologi

- Temuan berbasis **bukti kode** (bukan spekulasi fitur yang “mungkin” hilang).  
- Tidak menjalankan suite test otomatis / load test di lingkungan ini.  
- Severity: **Critical** = korupsi stok/uang atau crash alur utama; **High** = kontrol bisnis bisa dilanggar; **Medium** = salah data / UX berbahaya; **Low** = polish / docs.

---

*Dokumen QA hidup — update status temuan (Open / Fixed / Won’t fix) saat diperbaiki.*
