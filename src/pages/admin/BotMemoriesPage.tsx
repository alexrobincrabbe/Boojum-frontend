import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Brain } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { adminAPI } from '../../services/api';
import { toast } from 'react-toastify';
import './BotMemoriesPage.css';

export interface BotMemoryRecord {
  id: number;
  memoryText: string;
  metadata: Record<string, unknown>;
}

export default function BotMemoriesPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const botName = searchParams.get('name')?.trim() || '';
  const botId = searchParams.get('bot')?.trim() || '';

  const [users, setUsers] = useState<string[]>([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [memories, setMemories] = useState<BotMemoryRecord[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingMemories, setLoadingMemories] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    setError(null);
    try {
      const data = await adminAPI.listBotMemoryUsers();
      const loadedUsers = data.users || [];
      setUsers(loadedUsers);
      setSelectedUser((prev) => {
        if (prev && loadedUsers.includes(prev)) return prev;
        return loadedUsers[0] ?? '';
      });
    } catch {
      setError('Failed to load memory users');
      toast.error('Failed to load memory users');
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    if (user?.is_superuser) {
      loadUsers();
    }
  }, [user, loadUsers]);

  useEffect(() => {
    if (!selectedUser) {
      setMemories([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingMemories(true);
      setError(null);
      try {
        const data = await adminAPI.listBotMemoriesForUser(selectedUser);
        if (!cancelled) {
          setMemories(data.memories || []);
        }
      } catch {
        if (!cancelled) {
          setError(`Failed to load memories for ${selectedUser}`);
        }
      } finally {
        if (!cancelled) {
          setLoadingMemories(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedUser]);

  const emptyText = useMemo(() => {
    if (!selectedUser) return 'No players with stored memories yet';
    if (loadingMemories) return 'Loading memories…';
    if (memories.length === 0) return `No memories for ${selectedUser} yet`;
    return '';
  }, [selectedUser, loadingMemories, memories.length]);

  const onClearSelectedUser = async () => {
    if (!selectedUser || clearing) return;
    const ok = window.confirm(`Clear all memories for ${selectedUser}?`);
    if (!ok) return;
    setClearing(true);
    setError(null);
    try {
      await adminAPI.clearBotMemoriesForUser(selectedUser);
      toast.success(`Cleared memories for ${selectedUser}`);
      setMemories([]);
      await loadUsers();
    } catch {
      setError(`Failed to clear memories for ${selectedUser}`);
      toast.error('Failed to clear memories');
    } finally {
      setClearing(false);
    }
  };

  if (!user?.is_superuser) {
    return (
      <main className="bot-memories-page">
        <p>Superuser access required.</p>
      </main>
    );
  }

  const backHref = botId ? `/admin/bot-control` : '/admin';

  return (
    <main className="bot-memories-page">
      <div className="play-toolbar">
        <div>
          <Link to={backHref} className="bot-memories-back">
            <ArrowLeft size={18} /> Back to bot control
          </Link>
          <h1 className="page-heading">
            <Brain size={28} style={{ verticalAlign: 'middle', marginRight: '0.35rem' }} />
            Bot memories
          </h1>
          <p className="muted">
            {botName
              ? `Semantic memories the chat system has stored about players (from ${botName} and other bots).`
              : 'Semantic memories stored per player username.'}
          </p>
        </div>
      </div>

      {error && <p className="bot-memories-error">{error}</p>}

      <section className="layout">
        <div className="card">
          <h2>Players</h2>
          {loadingUsers && <p className="muted">Loading…</p>}
          {!loadingUsers && users.length === 0 && <p className="muted">No memory users yet.</p>}
          <ul className="memory-user-list">
            {users.map((name) => (
              <li key={name}>
                <button
                  type="button"
                  className={name === selectedUser ? 'memory-user-selected' : ''}
                  onClick={() => setSelectedUser(name)}
                >
                  {name}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="card card-elevated">
          <div className="memory-detail-header">
            <h2>{selectedUser ? `Memories for ${selectedUser}` : 'Memories'}</h2>
            {selectedUser ? (
              <button
                type="button"
                className="btn btn-danger"
                onClick={onClearSelectedUser}
                disabled={clearing}
              >
                {clearing ? 'Clearing…' : 'Clear all'}
              </button>
            ) : null}
          </div>
          {emptyText && <p className="muted">{emptyText}</p>}
          {!emptyText && (
            <ul className="memory-record-list">
              {memories.map((m) => (
                <li key={m.id}>
                  <p>{m.memoryText}</p>
                  {Object.keys(m.metadata || {}).length > 0 && (
                    <small>{JSON.stringify(m.metadata)}</small>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
