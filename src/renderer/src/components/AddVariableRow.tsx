import { Plus } from "lucide-react";

interface AddVariableRowProps {
  envName: string;
  newVarKey: string;
  newVarValue: string;
  newVarSecret: boolean;
  setNewVarKey: (v: string) => void;
  setNewVarValue: (v: string) => void;
  setNewVarSecret: (v: boolean) => void;
  onSave: (key: string, value: string, secret: boolean) => Promise<void>;
}

export function AddVariableRow({
  newVarKey,
  newVarValue,
  newVarSecret,
  setNewVarKey,
  setNewVarValue,
  setNewVarSecret,
  onSave,
}: AddVariableRowProps) {
  return (
    <div className="env-add-variable" aria-label="Add variable">
      <div className="env-add-variable-fields">
        <input
          value={newVarKey}
          onChange={e => setNewVarKey(e.target.value)}
          placeholder="New key"
          aria-label="Variable key"
        />
        <input
          value={newVarValue}
          onChange={e => setNewVarValue(e.target.value)}
          placeholder={newVarSecret ? 'Secret value' : 'Value'}
          aria-label="Variable value"
          type={newVarSecret ? 'password' : 'text'}
        />
      </div>
      <div className="env-add-variable-actions">
        <label className="env-secret-toggle">
          <input type="checkbox" checked={newVarSecret} onChange={e => setNewVarSecret(e.target.checked)} />
          Secret
        </label>
        <button
          type="button"
          className="ghost-button"
          onClick={() => void onSave(newVarKey, newVarValue, newVarSecret)}
        >
          <Plus size={12} /> Add
        </button>
      </div>
    </div>
  );
}
