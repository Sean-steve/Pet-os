import React, { useState } from 'react';
import { 
  testUUIDv7Generation, 
  testMoneyAllocation, 
  testErrorEnvelope, 
  testAuditLogging 
} from '../pet-os/sprint1/runner';
import { CurrencyCode } from '../pet-os/kernel/money';
import { ErrorCode, ERROR_REGISTRY } from '../pet-os/kernel/errors';
import { InMemoryAuditStore, AuditEventRecord, DataClassification } from '../pet-os/kernel/audit';
import { computePetAge, PetBirthRecord, BirthDatePrecision } from '../pet-os/kernel/time';
import { 
  Cpu, 
  Coins, 
  AlertTriangle, 
  Clock, 
  Sparkles, 
  CheckCircle2, 
  Shield,
  Layers,
  Code2
} from 'lucide-react';

export const KernelPlayground: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'ids' | 'money' | 'time' | 'errors' | 'audit'>('ids');

  // Subtab 1: UUIDv7 state
  const [generatedIds, setGeneratedIds] = useState<Array<ReturnType<typeof testUUIDv7Generation>>>(() => [
    testUUIDv7Generation(),
    testUUIDv7Generation()
  ]);

  // Subtab 2: Money state
  const [amountMajor, setAmountMajor] = useState<number>(3500); // 3,500 KES
  const [currency, setCurrency] = useState<CurrencyCode>('KES');
  const [ratioProvider, setRatioProvider] = useState<number>(80);
  const [ratioPlatform, setRatioPlatform] = useState<number>(15);
  const [ratioFee, setRatioFee] = useState<number>(5);

  const allocationResult = testMoneyAllocation(
    amountMajor, 
    currency, 
    [ratioProvider, ratioPlatform, ratioFee]
  );

  // Subtab 3: Time / Pet Age state
  const [birthDate, setBirthDate] = useState<string>('2023-04-15');
  const [precision, setPrecision] = useState<BirthDatePrecision>('exact');
  const petAgeResult = computePetAge({ date: birthDate, precision });

  // Subtab 4: Error contracts
  const [selectedErrorCode, setSelectedErrorCode] = useState<ErrorCode>('WALK_001');
  const [customErrorMsg, setCustomErrorMsg] = useState<string>('');
  const errorEnvelope = testErrorEnvelope(selectedErrorCode, customErrorMsg || undefined);

  // Subtab 5: Audit events
  const [auditList, setAuditList] = useState<AuditEventRecord[]>(() => InMemoryAuditStore.getRecent(10));
  const [actionName, setActionName] = useState<string>('VACCINATION_RECORDED');
  const [resourceType, setResourceType] = useState<string>('pet_vaccination');
  const [classification, setClassification] = useState<DataClassification>('CONFIDENTIAL');

  const handleGenerateId = () => {
    setGeneratedIds([testUUIDv7Generation(), ...generatedIds.slice(0, 7)]);
  };

  const handleLogAudit = () => {
    testAuditLogging(
      actionName,
      resourceType,
      'res_' + Math.random().toString(36).slice(2, 8),
      classification,
      'USER_INITIATED_COMMAND'
    );
    setAuditList(InMemoryAuditStore.getRecent(10));
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Sub-nav */}
      <div className="flex flex-wrap gap-2 border-b border-[#1E293B] pb-3">
        <button
          id="btn-kernel-subtab-ids"
          onClick={() => setActiveSubTab('ids')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
            activeSubTab === 'ids'
              ? 'bg-[#1E293B] text-[#A5B4FC] border border-[#312E81] shadow-sm'
              : 'text-[#64748B] hover:text-[#E2E8F0] hover:bg-[#13151A]'
          }`}
        >
          <Cpu className="w-3.5 h-3.5" />
          <span>UUIDv7 Generator (ADR-003)</span>
        </button>

        <button
          id="btn-kernel-subtab-money"
          onClick={() => setActiveSubTab('money')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
            activeSubTab === 'money'
              ? 'bg-[#1E293B] text-[#A5B4FC] border border-[#312E81] shadow-sm'
              : 'text-[#64748B] hover:text-[#E2E8F0] hover:bg-[#13151A]'
          }`}
        >
          <Coins className="w-3.5 h-3.5" />
          <span>Money &amp; M-PESA Engine (ADR-012)</span>
        </button>

        <button
          id="btn-kernel-subtab-time"
          onClick={() => setActiveSubTab('time')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
            activeSubTab === 'time'
              ? 'bg-[#1E293B] text-[#A5B4FC] border border-[#312E81] shadow-sm'
              : 'text-[#64748B] hover:text-[#E2E8F0] hover:bg-[#13151A]'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Pet Age &amp; Precision (PETPET-001)</span>
        </button>

        <button
          id="btn-kernel-subtab-errors"
          onClick={() => setActiveSubTab('errors')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
            activeSubTab === 'errors'
              ? 'bg-[#1E293B] text-[#A5B4FC] border border-[#312E81] shadow-sm'
              : 'text-[#64748B] hover:text-[#E2E8F0] hover:bg-[#13151A]'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Error Contracts &amp; Envelopes</span>
        </button>

        <button
          id="btn-kernel-subtab-audit"
          onClick={() => setActiveSubTab('audit')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
            activeSubTab === 'audit'
              ? 'bg-[#1E293B] text-[#A5B4FC] border border-[#312E81] shadow-sm'
              : 'text-[#64748B] hover:text-[#E2E8F0] hover:bg-[#13151A]'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          <span>Audit Log Stream</span>
        </button>
      </div>

      {/* Tab 1: UUIDv7 */}
      {activeSubTab === 'ids' && (
        <div className="bg-[#13151A] rounded-3xl p-6 sm:p-8 border border-[#1E293B] shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-[#F8FAFC]">RFC 9562 UUIDv7 Time-Ordered ID Engine</h2>
              <p className="text-xs text-[#64748B]">
                Rule ADR-003 &amp; PETXXX-001: All externally visible primary IDs use UUIDv7 to guarantee global uniqueness and monotonic chronological indexing.
              </p>
            </div>
            <button
              id="btn-generate-uuidv7"
              onClick={handleGenerateId}
              className="px-4 py-2 rounded-xl bg-[#A5B4FC] hover:bg-[#C7D2FE] text-[#0F1115] font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Generate UUIDv7</span>
            </button>
          </div>

          <div className="space-y-3">
            {generatedIds.map((item, index) => (
              <div
                key={item.id}
                className="p-4 rounded-2xl border border-[#1E293B] bg-[#0F1115] hover:border-[#312E81] transition-all font-mono text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[#475569] text-[10px]">#{index + 1}</span>
                    <span className="font-bold text-[#F8FAFC] text-sm tracking-wide">{item.id}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-[#A5B4FC] border border-[#312E81]">
                      RFC 9562 v7
                    </span>
                  </div>
                  <div className="text-[#64748B] text-[11px]">
                    Decoded UTC: <span className="text-[#E2E8F0] font-semibold">{item.timestamp}</span> ({item.humanDate})
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-green-400 bg-green-500/10 border border-green-500/20 px-2.5 py-1 rounded-full">
                    ✓ Valid Timestamp Prefix
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Money & M-PESA */}
      {activeSubTab === 'money' && (
        <div className="bg-[#13151A] rounded-3xl p-6 sm:p-8 border border-[#1E293B] shadow-sm space-y-6">
          <div>
            <h2 className="text-base font-semibold text-[#F8FAFC]">Integer Minor-Unit Financial Engine (ADR-012, Volume XVII)</h2>
            <p className="text-xs text-[#64748B]">
              Rule PETXXX-002: Money MUST use integer minor units and ISO 4217 currency—never float.
              Demonstrating lossless fee splitting for Kenya M-PESA transactions.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-[#0F1115] p-5 rounded-2xl border border-[#1E293B]">
            <div>
              <label className="block text-xs font-semibold text-[#94A3B8] mb-1.5">Total Amount (Major Units)</label>
              <div className="flex rounded-xl overflow-hidden border border-[#1E293B] bg-[#0B0D10]">
                <input
                  id="input-money-amount"
                  type="number"
                  value={amountMajor}
                  onChange={(e) => setAmountMajor(Math.max(0, Number(e.target.value)))}
                  className="w-full px-3 py-2 text-sm text-[#F1F5F9] font-mono focus:outline-none bg-transparent"
                />
                <select
                  id="select-currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                  className="bg-[#1E293B] px-3 text-xs font-bold text-[#A5B4FC] border-l border-[#1E293B] focus:outline-none"
                >
                  <option value="KES">KES</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>
              <span className="text-[10px] text-[#64748B] font-mono mt-1.5 block">
                Committed integer: <strong className="text-[#A5B4FC]">{allocationResult.original.amount_minor}</strong> minor units
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#94A3B8] mb-1.5">Provider Share Ratio</label>
              <input
                id="input-ratio-provider"
                type="number"
                value={ratioProvider}
                onChange={(e) => setRatioProvider(Math.max(0, Number(e.target.value)))}
                className="w-full px-3 py-2 text-sm text-[#F1F5F9] font-mono rounded-xl border border-[#1E293B] bg-[#0B0D10] focus:outline-none focus:border-[#312E81]"
              />
              <span className="text-[10px] text-[#64748B] mt-1.5 block">E.g., 80% to Service Provider</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#94A3B8] mb-1.5">Platform Commission / M-PESA Fee</label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  id="input-ratio-platform"
                  type="number"
                  value={ratioPlatform}
                  onChange={(e) => setRatioPlatform(Math.max(0, Number(e.target.value)))}
                  className="px-2.5 py-2 text-sm text-[#F1F5F9] font-mono rounded-xl border border-[#1E293B] bg-[#0B0D10]"
                  title="Platform ratio"
                />
                <input
                  id="input-ratio-fee"
                  type="number"
                  value={ratioFee}
                  onChange={(e) => setRatioFee(Math.max(0, Number(e.target.value)))}
                  className="px-2.5 py-2 text-sm text-[#F1F5F9] font-mono rounded-xl border border-[#1E293B] bg-[#0B0D10]"
                  title="M-PESA / processing ratio"
                />
              </div>
              <span className="text-[10px] text-[#64748B] mt-1.5 block">15% platform + 5% gateway fee</span>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#475569]">
              Lossless Allocation Breakdown (Footsie Rounding Algorithm)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-2xl border border-green-500/20 bg-green-500/5">
                <div className="text-[11px] font-semibold text-green-400">1. Service Provider Payout</div>
                <div className="text-xl font-bold text-[#F1F5F9] font-mono mt-1">
                  {allocationResult.shares[0]?.formatted}
                </div>
                <div className="text-[10px] font-mono text-green-500/80 mt-0.5">
                  {allocationResult.shares[0]?.amount_minor} minor units ({ratioProvider} parts)
                </div>
              </div>

              <div className="p-4 rounded-2xl border border-[#312E81] bg-[#1E1B4B]/30">
                <div className="text-[11px] font-semibold text-[#A5B4FC]">2. Pet OS Platform Revenue</div>
                <div className="text-xl font-bold text-[#F1F5F9] font-mono mt-1">
                  {allocationResult.shares[1]?.formatted}
                </div>
                <div className="text-[10px] font-mono text-[#A5B4FC]/80 mt-0.5">
                  {allocationResult.shares[1]?.amount_minor} minor units ({ratioPlatform} parts)
                </div>
              </div>

              <div className="p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5">
                <div className="text-[11px] font-semibold text-amber-400">3. M-PESA / Rails Reserve</div>
                <div className="text-xl font-bold text-[#F1F5F9] font-mono mt-1">
                  {allocationResult.shares[2]?.formatted}
                </div>
                <div className="text-[10px] font-mono text-amber-400/80 mt-0.5">
                  {allocationResult.shares[2]?.amount_minor} minor units ({ratioFee} parts)
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#0B0D10] text-[#E2E8F0] border border-[#1E293B] text-xs">
              <span className="text-[#94A3B8]">Total Minor Units Reconciled:</span>
              <div className="flex items-center gap-2.5">
                <span className="font-mono font-bold text-[#A5B4FC]">
                  {allocationResult.totalAllocatedMinor} / {allocationResult.original.amount_minor} minor units
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 text-[10px] font-bold uppercase tracking-wider">
                  Zero Rounding Error
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Pet Age & Precision */}
      {activeSubTab === 'time' && (
        <div className="bg-[#13151A] rounded-3xl p-6 sm:p-8 border border-[#1E293B] shadow-sm space-y-6">
          <div>
            <h2 className="text-base font-semibold text-[#F8FAFC]">Pet Age &amp; Temporal Precision (PETPET-001)</h2>
            <p className="text-xs text-[#64748B]">
              Rule PETPET-001: Birth date MUST record precision as exact, estimated-month/year, or unknown.
              Exact dates permit exact chronological age; estimated values display transparent approximate notation.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#0F1115] p-5 rounded-2xl border border-[#1E293B]">
            <div>
              <label className="block text-xs font-semibold text-[#94A3B8] mb-1.5">Birth Date (ISO 8601)</label>
              <input
                id="input-pet-birthdate"
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="w-full px-3 py-2 text-sm text-[#F1F5F9] font-mono rounded-xl border border-[#1E293B] bg-[#0B0D10]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#94A3B8] mb-1.5">Precision Classification</label>
              <select
                id="select-birthdate-precision"
                value={precision}
                onChange={(e) => setPrecision(e.target.value as BirthDatePrecision)}
                className="w-full px-3 py-2 text-sm text-[#F1F5F9] font-medium rounded-xl border border-[#1E293B] bg-[#0B0D10]"
              >
                <option value="exact">Exact (Known verified birthdate)</option>
                <option value="estimated_month">Estimated Month / Year (Shelter / Rescue)</option>
                <option value="estimated_year">Estimated Year Only (Adoption / Stray)</option>
                <option value="unknown">Unknown (Age undetermined)</option>
              </select>
            </div>
          </div>

          <div className="p-5 rounded-2xl border border-[#1E293B] bg-[#0F1115] flex items-center justify-between">
            <div>
              <div className="text-xs text-[#64748B]">Canonical Lifecycle Display:</div>
              <div className="text-2xl font-bold text-[#F8FAFC] mt-1 tracking-tight">
                {petAgeResult.displayAge}
              </div>
            </div>
            <div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                petAgeResult.isApproximate 
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' 
                  : 'bg-green-500/10 text-green-400 border border-green-500/20'
              }`}>
                {petAgeResult.isApproximate ? 'Approximate Window' : 'Verified Exact'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Error Contracts */}
      {activeSubTab === 'errors' && (
        <div className="bg-[#13151A] rounded-3xl p-6 sm:p-8 border border-[#1E293B] shadow-sm space-y-6">
          <div>
            <h2 className="text-base font-semibold text-[#F8FAFC]">Standardized API Error Envelope (Volume XXVIII)</h2>
            <p className="text-xs text-[#64748B]">
              Rule PETXXPETIII-003: Errors MUST use stable machine codes, appropriate HTTP status, safe human messages, and correlation tracking.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#94A3B8] mb-1.5">Machine Error Code</label>
              <select
                id="select-error-code"
                value={selectedErrorCode}
                onChange={(e) => setSelectedErrorCode(e.target.value as ErrorCode)}
                className="w-full px-3 py-2 text-xs font-mono text-[#F1F5F9] rounded-xl border border-[#1E293B] bg-[#0B0D10]"
              >
                {Object.keys(ERROR_REGISTRY).map((code) => {
                  const item = ERROR_REGISTRY[code as ErrorCode];
                  return (
                    <option key={code} value={code}>
                      {item.code} - {item.name} ({item.httpStatus})
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#94A3B8] mb-1.5">Optional Custom Message Override</label>
              <input
                id="input-custom-err-msg"
                type="text"
                placeholder="Leave blank for canonical default"
                value={customErrorMsg}
                onChange={(e) => setCustomErrorMsg(e.target.value)}
                className="w-full px-3 py-2 text-xs text-[#F1F5F9] rounded-xl border border-[#1E293B] bg-[#0B0D10]"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#475569]">
              JSON Response Envelope:
            </div>
            <pre className="p-4 rounded-2xl bg-[#0B0D10] text-[#A5B4FC] font-mono text-xs overflow-x-auto border border-[#1E293B] shadow-inner">
              {JSON.stringify(errorEnvelope, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* Tab 5: Audit Log Stream */}
      {activeSubTab === 'audit' && (
        <div className="bg-[#13151A] rounded-3xl p-6 sm:p-8 border border-[#1E293B] shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-[#F8FAFC]">Append-Only Audit Stream (Volume XXXI)</h2>
              <p className="text-xs text-[#64748B]">
                Rule PETXXX-004 &amp; Volume XXXI: Privileged and state-changing actions logged with immutable actor, classification, and correlation IDs.
              </p>
            </div>
            <button
              id="btn-log-audit-event"
              onClick={handleLogAudit}
              className="px-4 py-2 rounded-xl bg-[#A5B4FC] hover:bg-[#C7D2FE] text-[#0F1115] font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 active:scale-[0.98] transition-all"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Record Audit Entry</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#0F1115] p-4 rounded-2xl border border-[#1E293B] text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-[#64748B] mb-1">Action Name</label>
              <input
                type="text"
                value={actionName}
                onChange={(e) => setActionName(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-[#1E293B] bg-[#0B0D10] text-xs font-mono text-[#F1F5F9]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#64748B] mb-1">Resource Type</label>
              <input
                type="text"
                value={resourceType}
                onChange={(e) => setResourceType(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-[#1E293B] bg-[#0B0D10] text-xs font-mono text-[#F1F5F9]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#64748B] mb-1">Classification</label>
              <select
                value={classification}
                onChange={(e) => setClassification(e.target.value as DataClassification)}
                className="w-full px-3 py-1.5 rounded-lg border border-[#1E293B] bg-[#0B0D10] text-xs font-semibold text-[#F1F5F9]"
              >
                <option value="PUBLIC">PUBLIC</option>
                <option value="INTERNAL">INTERNAL</option>
                <option value="CONFIDENTIAL">CONFIDENTIAL</option>
                <option value="RESTRICTED">RESTRICTED</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#475569]">
              Recent Audit Stream ({auditList.length})
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto">
              {auditList.map((audit) => (
                <div
                  key={audit.id}
                  className="p-3.5 rounded-2xl border border-[#1E293B] bg-[#0F1115] text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[#F1F5F9]">{audit.action}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                        audit.classification === 'RESTRICTED'
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : audit.classification === 'CONFIDENTIAL'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-[#1E293B] text-[#94A3B8]'
                      }`}>
                        {audit.classification}
                      </span>
                    </div>
                    <div className="text-[#64748B] text-[11px]">
                      Resource: <span className="font-mono text-[#E2E8F0]">{audit.resourceType}/{audit.resourceId}</span> · Actor: <span className="font-mono text-[#E2E8F0]">{audit.actorId} ({audit.actorType})</span>
                    </div>
                  </div>

                  <div className="text-right text-[11px] font-mono text-[#475569] shrink-0">
                    <div>CID: {audit.correlationId.slice(0, 8)}...</div>
                    <div>{new Date(audit.occurredAt).toLocaleTimeString()}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
