import { useEffect, useMemo, useState } from 'react';
import { GEOFENCE_MIN_POINT_COUNT } from '../constants/telemetry';
import type { GeofenceManagementPanelProps } from '../interfaces/components';
import SectionHeader from './SectionHeader';

type GeofencePanelTab = 'draw' | 'saved';

function DrawTab({
  geofenceDraftName,
  geofenceDraftPoints,
  selectedDraftVertexIndex,
  geofenceEditorMode,
  editingGeofenceId,
  isSaving,
  geofenceError,
  onStartCreateDraft,
  onUpdateDraftName,
  onSelectDraftVertex,
  onUndoDraftVertex,
  onRemoveSelectedDraftVertex,
  onClearDraftVertices,
  onSaveDraft,
  onCancelDraft,
}: Omit<
  GeofenceManagementPanelProps,
  'geofences' | 'onStartEditGeofence' | 'onToggleGeofenceActive' | 'onDeleteGeofence'
>) {
  const hasDraft = geofenceDraftPoints.length > 0 || geofenceDraftName.trim().length > 0;
  const canSave = geofenceDraftName.trim().length > 0
    && geofenceDraftPoints.length >= GEOFENCE_MIN_POINT_COUNT
    && !isSaving;
  const canRemoveSelected = selectedDraftVertexIndex !== null
    && selectedDraftVertexIndex >= 0
    && selectedDraftVertexIndex < geofenceDraftPoints.length;

  const selectedVertexLabel = selectedDraftVertexIndex === null
    ? 'NONE'
    : `${selectedDraftVertexIndex + 1}`;

  return (
    <div className="flex flex-col h-full min-h-0">
      <SectionHeader title={geofenceEditorMode === 'edit' ? 'EDIT GEOFENCE' : 'DRAW GEOFENCE'} />

      <div className="px-3 py-2 border-b border-line">
        <div className="text-[9px] text-muted tracking-widest uppercase mb-1">NAME</div>
        <input
          type="text"
          value={geofenceDraftName}
          onChange={(event) => onUpdateDraftName(event.target.value)}
          placeholder="PERIMETER-ALPHA"
          maxLength={100}
          className="w-full bg-elevated border border-line text-neon text-[10px] font-mono px-2 py-1 tracking-wider placeholder:text-muted focus:outline-none focus:border-neon uppercase"
        />
        <div className="mt-1 text-[9px] tracking-widest uppercase text-muted">
          MODE: <span className="text-neon">{geofenceEditorMode === 'edit' ? `EDIT #${editingGeofenceId}` : 'CREATE'}</span>
        </div>
      </div>

      <div className="px-3 py-2 border-b border-line text-[9px] tracking-widest uppercase">
        <div className="flex justify-between">
          <span className="text-muted">VERTICES</span>
          <span className={geofenceDraftPoints.length < GEOFENCE_MIN_POINT_COUNT ? 'text-caution' : 'text-neon'}>
            {geofenceDraftPoints.length}
          </span>
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-muted">SELECTED</span>
          <span className="text-neon">{selectedVertexLabel}</span>
        </div>
      </div>

      <div className="px-3 py-2 border-b border-line flex flex-col gap-1.5">
        <button
          type="button"
          onClick={onStartCreateDraft}
          disabled={isSaving}
          className="w-full py-1 text-[9px] tracking-widest uppercase font-bold border border-line text-muted hover:border-neon hover:text-neon disabled:opacity-40 disabled:cursor-not-allowed"
        >
          NEW DRAFT
        </button>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={onUndoDraftVertex}
            disabled={isSaving || geofenceDraftPoints.length === 0}
            className="flex-1 py-1 text-[9px] tracking-widest uppercase font-bold border border-line text-muted hover:border-caution hover:text-caution disabled:opacity-40 disabled:cursor-not-allowed"
          >
            UNDO
          </button>
          <button
            type="button"
            onClick={onRemoveSelectedDraftVertex}
            disabled={isSaving || !canRemoveSelected}
            className="flex-1 py-1 text-[9px] tracking-widest uppercase font-bold border border-line text-muted hover:border-caution hover:text-caution disabled:opacity-40 disabled:cursor-not-allowed"
          >
            REMOVE
          </button>
          <button
            type="button"
            onClick={() => onSelectDraftVertex(null)}
            disabled={isSaving || selectedDraftVertexIndex === null}
            className="flex-1 py-1 text-[9px] tracking-widest uppercase font-bold border border-line text-muted hover:border-neon hover:text-neon disabled:opacity-40 disabled:cursor-not-allowed"
          >
            CLEAR SEL
          </button>
        </div>
        <button
          type="button"
          onClick={onClearDraftVertices}
          disabled={isSaving || geofenceDraftPoints.length === 0}
          className="w-full py-1 text-[9px] tracking-widest uppercase font-bold border border-line text-muted hover:border-danger hover:text-danger disabled:opacity-40 disabled:cursor-not-allowed"
        >
          CLEAR ALL VERTICES
        </button>
      </div>

      <div className="px-3 py-2 border-b border-line text-[9px] tracking-widest uppercase text-muted">
        MAP CONTROLS: LEFT CLICK ADDS VERTEX, CLICK OR DRAG EXISTING VERTEX TO EDIT.
      </div>

      {geofenceError && (
        <div className="px-3 py-1 border-b border-line text-[9px] tracking-widest uppercase text-danger">
          {geofenceError}
        </div>
      )}

      <div className="mt-auto p-3 border-t border-line flex gap-1.5">
        <button
          type="button"
          onClick={() => void onSaveDraft()}
          disabled={!canSave}
          className="flex-1 py-1.5 text-[9px] tracking-widest uppercase font-bold border border-neon text-neon hover:bg-neon hover:text-surface disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isSaving ? 'SAVING...' : geofenceEditorMode === 'edit' ? 'SAVE EDIT' : 'SAVE'}
        </button>
        <button
          type="button"
          onClick={onCancelDraft}
          disabled={isSaving || !hasDraft}
          className="px-3 py-1.5 text-[9px] tracking-widest uppercase font-bold border border-line text-muted hover:border-danger hover:text-danger disabled:opacity-40 disabled:cursor-not-allowed"
        >
          CANCEL
        </button>
      </div>
    </div>
  );
}

export default function GeofenceManagementPanel({
  geofences,
  geofenceDraftName,
  geofenceDraftPoints,
  selectedDraftVertexIndex,
  geofenceEditorMode,
  editingGeofenceId,
  isSaving,
  geofenceError,
  onStartCreateDraft,
  onStartEditGeofence,
  onUpdateDraftName,
  onSelectDraftVertex,
  onUndoDraftVertex,
  onRemoveSelectedDraftVertex,
  onClearDraftVertices,
  onSaveDraft,
  onCancelDraft,
  onToggleGeofenceActive,
  onDeleteGeofence,
}: GeofenceManagementPanelProps) {
  const [activeTab, setActiveTab] = useState<GeofencePanelTab>('draw');
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  useEffect(() => {
    if (geofenceEditorMode === 'edit') {
      setActiveTab('draw');
    }
  }, [geofenceEditorMode]);

  const orderedGeofences = useMemo(
    () => [...geofences].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    [geofences],
  );

  return (
    <div className="w-52 bg-panel border-l border-line flex flex-col min-h-0 overflow-hidden">
      <div className="px-3 pt-2 pb-0 border-b border-line">
        <div className="text-[9px] text-muted tracking-widest uppercase mb-2">GEOFENCE CONTROL</div>
        <div className="flex">
          {(['draw', 'saved'] as GeofencePanelTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setActiveTab(tab);
                setPendingDeleteId(null);
              }}
              className={`flex-1 py-1 text-[9px] tracking-widest uppercase font-bold border-b-2 ${
                activeTab === tab
                  ? 'border-caution text-caution'
                  : 'border-transparent text-muted hover:text-caution'
              }`}
            >
              {tab === 'draw' ? 'DRAW' : `SAVED (${geofences.length})`}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {activeTab === 'draw' ? (
          <DrawTab
            geofenceDraftName={geofenceDraftName}
            geofenceDraftPoints={geofenceDraftPoints}
            selectedDraftVertexIndex={selectedDraftVertexIndex}
            geofenceEditorMode={geofenceEditorMode}
            editingGeofenceId={editingGeofenceId}
            isSaving={isSaving}
            geofenceError={geofenceError}
            onStartCreateDraft={onStartCreateDraft}
            onUpdateDraftName={onUpdateDraftName}
            onSelectDraftVertex={onSelectDraftVertex}
            onUndoDraftVertex={onUndoDraftVertex}
            onRemoveSelectedDraftVertex={onRemoveSelectedDraftVertex}
            onClearDraftVertices={onClearDraftVertices}
            onSaveDraft={onSaveDraft}
            onCancelDraft={onCancelDraft}
          />
        ) : (
          <div className="flex flex-col h-full min-h-0">
            <SectionHeader title="SAVED GEOFENCES" />
            {orderedGeofences.length === 0 && (
              <div className="px-3 py-4 text-[10px] text-muted tracking-widest text-center">
                NO SAVED GEOFENCES
              </div>
            )}
            <div className="flex-1 overflow-y-auto">
              {orderedGeofences.map((geofence) => {
                const isPendingDelete = pendingDeleteId === geofence.id;
                const isEditing = geofenceEditorMode === 'edit' && editingGeofenceId === geofence.id;
                return (
                  <div key={geofence.id} className="border-b border-line px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[10px] font-bold truncate ${isEditing ? 'text-caution' : 'text-neon'}`}>
                        {geofence.name}
                      </span>
                      <span className={`text-[8px] tracking-widest ${geofence.isActive ? 'text-neon' : 'text-muted'}`}>
                        {geofence.isActive ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </div>
                    <div className="text-[9px] text-muted mt-0.5 tracking-widest">
                      {geofence.points.length} VERTICES
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => onStartEditGeofence(geofence.id)}
                        disabled={isSaving}
                        className="px-2 py-1 text-[8px] tracking-widest uppercase font-bold border border-line text-caution hover:border-caution disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        EDIT
                      </button>
                      <button
                        type="button"
                        onClick={() => void onToggleGeofenceActive(geofence.id, !geofence.isActive)}
                        disabled={isSaving}
                        className="px-2 py-1 text-[8px] tracking-widest uppercase font-bold border border-line text-neon hover:border-neon disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {geofence.isActive ? 'DEACTIVATE' : 'ACTIVATE'}
                      </button>
                      {!isPendingDelete && (
                        <button
                          type="button"
                          onClick={() => setPendingDeleteId(geofence.id)}
                          disabled={isSaving}
                          className="px-2 py-1 text-[8px] tracking-widest uppercase font-bold border border-line text-muted hover:border-danger hover:text-danger disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          DELETE
                        </button>
                      )}
                    </div>
                    {isPendingDelete && (
                      <div className="mt-2 border border-danger px-2 py-1.5">
                        <div className="text-[8px] tracking-widest uppercase text-danger">CONFIRM DELETE?</div>
                        <div className="mt-1 flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => void onDeleteGeofence(geofence.id).then(() => setPendingDeleteId(null))}
                            disabled={isSaving}
                            className="flex-1 py-1 text-[8px] tracking-widest uppercase font-bold border border-danger text-danger hover:bg-danger hover:text-surface disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            CONFIRM
                          </button>
                          <button
                            type="button"
                            onClick={() => setPendingDeleteId(null)}
                            disabled={isSaving}
                            className="flex-1 py-1 text-[8px] tracking-widest uppercase font-bold border border-line text-muted hover:border-neon hover:text-neon disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            CANCEL
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {geofenceError && (
              <div className="px-3 py-1 border-t border-line text-[9px] tracking-widest uppercase text-danger">
                {geofenceError}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
