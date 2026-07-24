import React, { useState, useMemo } from "react";
import { FolderTree, X, ChevronRight, Check } from "lucide-react";
import type { WorkspaceSummary, CollectionSummary, FolderSummary } from "../types";

interface MoveToModalProps {
  workspace: WorkspaceSummary;
  itemType: "request" | "folder";
  itemId: string;
  onClose: () => void;
  onMove: (type: "request" | "folder", draggedId: string, targetId: string, position: "top" | "bottom" | "inside") => void;
}

export function MoveToModal({ workspace, itemType, itemId, onClose, onMove }: MoveToModalProps) {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  // Get item name for display
  const itemName = useMemo(() => {
    if (itemType === "request") {
      return workspace.requests.find(r => r.id === itemId)?.name || "Request";
    }
    return workspace.folders.find(f => f.id === itemId)?.name || "Folder";
  }, [workspace, itemType, itemId]);

  // Build a tree of collections and folders
  const tree = useMemo(() => {
    const collections = [...(workspace.collections || [])]
      .map(c => ({ ...c, folders: [] as any[] }));
    
    // Create a map of folders
    const folderMap = new Map<string, any>();
    workspace.folders.forEach(f => {
      // Don't include the folder itself or its children if moving a folder
      if (itemType === "folder" && f.id === itemId) return;
      folderMap.set(f.id, { ...f, children: [] });
    });

    workspace.folders.forEach(f => {
      if (!folderMap.has(f.id)) return;
      const folderNode = folderMap.get(f.id);
      
      if (f.parentId) {
        if (folderMap.has(f.parentId)) {
          folderMap.get(f.parentId).children.push(folderNode);
        }
      } else if (f.collectionId) {
        const col = collections.find(c => c.id === f.collectionId);
        if (col) {
          col.folders.push(folderNode);
        }
      }
    });

    return collections;
  }, [workspace, itemType, itemId]);

  // Auto-expand all folders by default
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    workspace.folders.forEach(f => {
      initial[f.id] = true;
    });
    return initial;
  });

  const handleToggle = (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedFolders(prev => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  const handleMove = () => {
    if (selectedFolderId) {
      onMove(itemType, itemId, selectedFolderId, "inside");
      onClose();
    }
  };

  const renderFolderNode = (node: any, depth: number) => {
    const isExpanded = expandedFolders[node.id] !== false; // Default true
    const isSelected = selectedFolderId === node.id;
    const hasChildren = node.children && node.children.length > 0;

    return (
      <React.Fragment key={node.id}>
        <div 
          className={`sidebar-tree-row ${isSelected ? 'active' : ''}`}
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            paddingLeft: '12px',
            paddingRight: '12px',
            cursor: 'pointer',
            height: '28px',
            borderRadius: '4px',
            marginBottom: '2px',
            background: isSelected ? 'var(--color-surface-active)' : 'transparent',
            border: isSelected ? '1px solid var(--color-border-tint)' : '1px solid transparent',
          }}
          onClick={() => setSelectedFolderId(node.id)}
        >
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {hasChildren ? (
              <div 
                style={{ width: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '4px' }}
                onClick={(e) => handleToggle(node.id, e)}
              >
                <ChevronRight size={14} style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s ease", color: "var(--color-text-muted)" }} />
              </div>
            ) : (
              <div style={{ width: '14px', marginRight: '4px' }} />
            )}
            <FolderTree size={14} style={{ marginRight: '6px', color: "var(--color-text-muted)" }} />
            <span style={{ fontSize: '13px', color: isSelected ? 'var(--color-text-active)' : 'var(--color-text)' }}>{node.name}</span>
          </div>
          {isSelected && <Check size={14} style={{ color: 'var(--color-accent)' }} />}
        </div>
        
        {isExpanded && hasChildren && (
          <div style={{ 
            marginLeft: '19px', 
            borderLeft: '1px solid var(--color-border)',
            paddingLeft: '6px',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {node.children.map((child: any) => renderFolderNode(child, depth + 1))}
          </div>
        )}
      </React.Fragment>
    );
  };

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Move item"
      onClick={onClose}
    >
      <div
        className="modal settings-modal"
        style={{ width: "500px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="settings-header">
          <div>
            <span className="settings-kicker">Move Item</span>
            <h2>Move "{itemName}"</h2>
          </div>
          <button
            type="button"
            className="settings-close"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        <div className="settings-content" style={{ padding: "20px 24px" }}>
          <div className="settings-section">
            <div className="settings-section-heading">
              <h3>Destination folder</h3>
              <p>Select a collection or folder to move this item into.</p>
            </div>
            
            <div style={{ 
              maxHeight: "300px", 
              overflowY: "auto", 
              border: "1px solid var(--color-border)", 
              borderRadius: "8px", 
              background: "var(--color-surface)",
              padding: "8px",
              marginTop: "8px"
            }}>
              {tree.map(collection => (
                <div key={collection.id} style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '4px 8px', marginBottom: '4px' }}>
                    {collection.name}
                  </div>
                  {collection.folders.length > 0 ? (
                    collection.folders.map(folder => renderFolderNode(folder, 0))
                  ) : (
                    <div style={{ fontSize: '12px', color: 'var(--color-muted)', fontStyle: 'italic', paddingLeft: '16px' }}>
                      No folders
                    </div>
                  )}
                </div>
              ))}
              {tree.length === 0 && (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-muted)', fontSize: '13px' }}>
                  No collections found.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: "16px 24px",
          display: "flex",
          gap: "8px",
          justifyContent: "flex-end",
          borderTop: "1px solid var(--color-border)",
          background: "var(--color-surface)",
        }}>
          <button
            type="button"
            className="ghost-button"
            onClick={onClose}
            style={{ minHeight: "36px", padding: "0 16px" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleMove}
            disabled={!selectedFolderId}
            style={{
              minHeight: "36px",
              padding: "0 18px",
              border: 0,
              borderRadius: "8px",
              background: "linear-gradient(135deg, var(--color-text-active), #1d4ed8)",
              color: "#fff",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              opacity: !selectedFolderId ? 0.5 : 1,
              transition: "opacity 0.15s",
            }}
          >
            Move Here
          </button>
        </div>
      </div>
    </div>
  );
}
