import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { adminAPI } from '../../services/api';
import { toast } from 'react-toastify';
import { Bot, Plus, Trash2, ArrowLeft, Save } from 'lucide-react';
import './BotControlPage.css';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export interface BotScheduleSlot {
  weekdays: number[];
  start_time: string;
  end_time: string;
}

export interface GameBotRecord {
  id: number;
  user_id: number;
  username: string;
  display_name: string;
  profile_url: string;
  room_id: number;
  room_name: string;
  room_slug: string;
  personality_prompt: string;
  chat_enabled: boolean;
  words_per_minute: number;
  word_length_factor: number;
  congratulate_winner_chance: number;
  congratulate_best_word_chance: number;
  trace_chat_enabled: boolean;
  trace_events_enabled: boolean;
  is_active: boolean;
  schedules: BotScheduleSlot[];
}

interface LiveRoom {
  id: number;
  name: string;
  slug: string;
  type: string;
  visible: boolean;
}

const emptySchedule = (): BotScheduleSlot => ({
  weekdays: [0, 1, 2, 3, 4, 5, 6],
  start_time: '00:00',
  end_time: '23:59',
});

const BotControlPage = () => {
  const { user } = useAuth();
  const [bots, setBots] = useState<GameBotRecord[]>([]);
  const [rooms, setRooms] = useState<LiveRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [isCreatingBot, setIsCreatingBot] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [newName, setNewName] = useState('');
  const [newRoomId, setNewRoomId] = useState<number | ''>('');

  const selected = bots.find((b) => b.id === selectedId) ?? null;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminAPI.listBots();
      setBots(data.bots || []);
      setRooms(data.rooms || []);
    } catch {
      toast.error('Failed to load bots');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.is_superuser) load();
  }, [user, load]);

  if (!user?.is_superuser) {
    return (
      <div className="bot-control-page">
        <p>Superuser access required.</p>
      </div>
    );
  }

  const handleCreate = async () => {
    if (!newName.trim() || !newRoomId) {
      toast.error('Name and room are required');
      return;
    }
    setIsCreatingBot(true);
    try {
      const bot = await adminAPI.createBot({
        display_name: newName.trim(),
        room_id: Number(newRoomId),
      });
      toast.success(`Created bot ${bot.display_name}`);
      setNewName('');
      setCreating(false);
      await load();
      setSelectedId(bot.id);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || 'Failed to create bot');
    } finally {
      setIsCreatingBot(false);
    }
  };

  const handleSave = async () => {
    if (!selected || isSaving || isDeleting) return;
    setIsSaving(true);
    try {
      const updated = await adminAPI.updateBot(selected.id, {
        display_name: selected.display_name,
        room_id: selected.room_id,
        personality_prompt: selected.personality_prompt,
        chat_enabled: selected.chat_enabled,
        words_per_minute: selected.words_per_minute,
        word_length_factor: selected.word_length_factor,
        congratulate_winner_chance: selected.congratulate_winner_chance ?? 100,
        congratulate_best_word_chance: selected.congratulate_best_word_chance ?? 50,
        trace_chat_enabled: selected.trace_chat_enabled ?? true,
        trace_events_enabled: selected.trace_events_enabled ?? false,
        is_active: selected.is_active,
        schedules: selected.schedules,
      });
      setBots((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
      toast.success('Bot saved');
    } catch {
      toast.error('Failed to save bot');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (isSaving || isDeleting) return;
    if (!window.confirm('Delete this bot and its user account?')) return;
    setIsDeleting(true);
    try {
      await adminAPI.deleteBot(id);
      toast.success('Bot deleted');
      if (selectedId === id) setSelectedId(null);
      await load();
    } catch {
      toast.error('Failed to delete bot');
    } finally {
      setIsDeleting(false);
    }
  };

  const isBusy = isCreatingBot || isSaving || isDeleting;

  const updateSelected = (patch: Partial<GameBotRecord>) => {
    if (!selectedId) return;
    setBots((prev) =>
      prev.map((b) => (b.id === selectedId ? { ...b, ...patch } : b))
    );
  };

  return (
    <div className="bot-control-page">
      <div className="page-container">
        <div className="bot-control-header">
          <Link to="/admin" className="bot-control-back">
            <ArrowLeft size={18} /> Admin
          </Link>
          <h1>
            <Bot size={28} /> Bot Control
          </h1>
          <p className="bot-control-subtitle">
            AI players for live game rooms only. Schedules use UTC. Rooms keep running while a bot is scheduled in.
          </p>
        </div>

        {loading ? (
          <p>Loading…</p>
        ) : (
          <div className="bot-control-layout">
            <aside className="bot-list-panel">
              <button
                type="button"
                className="bot-create-btn"
                disabled={isBusy}
                onClick={() => setCreating((v) => !v)}
              >
                <Plus size={18} /> New bot
              </button>
              {creating && (
                <div className="bot-create-form">
                  <input
                    placeholder="Display name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    maxLength={20}
                    disabled={isCreatingBot}
                  />
                  <select
                    value={newRoomId}
                    onChange={(e) => setNewRoomId(e.target.value ? Number(e.target.value) : '')}
                    disabled={isCreatingBot}
                  >
                    <option value="">Select room…</option>
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="bot-create-submit-btn"
                    onClick={handleCreate}
                    disabled={isCreatingBot}
                  >
                    {isCreatingBot ? 'Creating…' : 'Create bot'}
                  </button>
                </div>
              )}
              <ul className="bot-list">
                {bots.map((b) => (
                  <li key={b.id}>
                    <button
                      type="button"
                      className={selectedId === b.id ? 'active' : ''}
                      onClick={() => setSelectedId(b.id)}
                    >
                      <span className="bot-list-name">{b.display_name}</span>
                      <span className="bot-list-room">{b.room_name}</span>
                      {!b.is_active && <span className="bot-list-inactive">inactive</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </aside>

            <section className="bot-editor-panel">
              {isCreatingBot ? (
                <div className="bot-editor-status" role="status" aria-live="polite">
                  <p className="bot-editor-status-title">Creating bot…</p>
                  <p className="bot-editor-status-detail">
                    Setting up the player account and opening the editor.
                  </p>
                </div>
              ) : isDeleting ? (
                <div className="bot-editor-status" role="status" aria-live="polite">
                  <p className="bot-editor-status-title">Deleting bot…</p>
                  <p className="bot-editor-status-detail">Removing the bot and its user account.</p>
                </div>
              ) : !selected ? (
                <p className="bot-editor-empty">Select a bot to edit, or create a new one.</p>
              ) : (
                <>
                  <div className="bot-editor-toolbar">
                    <h2>{selected.display_name}</h2>
                    <div className="bot-editor-actions">
                      <button
                        type="button"
                        className="btn-save"
                        onClick={handleSave}
                        disabled={isBusy}
                      >
                        <Save size={16} /> {isSaving ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        type="button"
                        className="btn-delete"
                        onClick={() => handleDelete(selected.id)}
                        disabled={isBusy}
                      >
                        <Trash2 size={16} /> {isDeleting ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  </div>
                  {isSaving && (
                    <p className="bot-editor-inline-status" role="status" aria-live="polite">
                      Saving changes…
                    </p>
                  )}

                  <label className="bot-field">
                    <span>Display name</span>
                    <input
                      value={selected.display_name}
                      maxLength={20}
                      onChange={(e) => updateSelected({ display_name: e.target.value })}
                    />
                  </label>

                  <label className="bot-field">
                    <span>Live room</span>
                    <select
                      value={selected.room_id}
                      onChange={(e) => {
                        const room = rooms.find((r) => r.id === Number(e.target.value));
                        updateSelected({
                          room_id: Number(e.target.value),
                          room_name: room?.name ?? selected.room_name,
                          room_slug: room?.slug ?? selected.room_slug,
                        });
                      }}
                    >
                      {rooms.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="bot-field bot-field-checkbox">
                    <input
                      type="checkbox"
                      checked={selected.is_active}
                      onChange={(e) => updateSelected({ is_active: e.target.checked })}
                    />
                    <span>Active (bot worker will join on schedule)</span>
                  </label>

                  <label className="bot-field bot-field-checkbox">
                    <input
                      type="checkbox"
                      checked={selected.chat_enabled ?? true}
                      onChange={(e) => updateSelected({ chat_enabled: e.target.checked })}
                    />
                    <span>Chat enabled (plays either way; when off, no messages)</span>
                  </label>

                  <label className="bot-field">
                    <span>Words per minute (5–200)</span>
                    <input
                      type="number"
                      min={5}
                      max={200}
                      value={selected.words_per_minute ?? 54}
                      onChange={(e) =>
                        updateSelected({
                          words_per_minute: Math.max(5, Math.min(200, Number(e.target.value) || 54)),
                        })
                      }
                    />
                    <span className="bot-field-hint">
                      Average find rate; capped by board size (never all words).
                    </span>
                  </label>

                  <label className="bot-field">
                    <span>Word length bias (1–10)</span>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={selected.word_length_factor ?? 5}
                      onChange={(e) =>
                        updateSelected({ word_length_factor: Number(e.target.value) })
                      }
                    />
                    <span className="bot-skill-value">{selected.word_length_factor}</span>
                    <span className="bot-field-hint">
                      1 = shorter words, 10 = longer words (weighted by board).
                    </span>
                  </label>

                  {!selected.chat_enabled && (
                    <p className="bot-field-hint">
                      Chat is off — this bot will still join rooms and submit scores, but will not send messages.
                    </p>
                  )}

                  {selected.chat_enabled && (
                  <>
                  <label className="bot-field">
                    <span>Congratulate winner (%)</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={selected.congratulate_winner_chance ?? 100}
                      onChange={(e) =>
                        updateSelected({
                          congratulate_winner_chance: Number(e.target.value),
                        })
                      }
                    />
                    <span className="bot-skill-value">
                      {selected.congratulate_winner_chance ?? 100}%
                    </span>
                    <span className="bot-field-hint">
                      Chance to name the winner in the post-round gg (0 = always plain gg).
                    </span>
                  </label>

                  <label className="bot-field">
                    <span>Congratulate best word (%)</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={selected.congratulate_best_word_chance ?? 50}
                      onChange={(e) =>
                        updateSelected({
                          congratulate_best_word_chance: Number(e.target.value),
                        })
                      }
                    />
                    <span className="bot-skill-value">
                      {selected.congratulate_best_word_chance ?? 50}%
                    </span>
                    <span className="bot-field-hint">
                      Chance to praise the highest-scoring best word after gg.
                    </span>
                  </label>

                  <label className="bot-field bot-field-checkbox">
                    <input
                      type="checkbox"
                      checked={selected.trace_chat_enabled ?? true}
                      onChange={(e) =>
                        updateSelected({ trace_chat_enabled: e.target.checked })
                      }
                    />
                    <span>Trace chat replies</span>
                  </label>
                  <label className="bot-field bot-field-checkbox">
                    <input
                      type="checkbox"
                      checked={selected.trace_events_enabled ?? false}
                      onChange={(e) =>
                        updateSelected({ trace_events_enabled: e.target.checked })
                      }
                    />
                    <span>Trace round-end / player-join events</span>
                  </label>
                  <p className="bot-field-hint">
                    Superusers see a trace link on bot replies, or “Round ended · Bot: (no response)” for silent event turns.
                  </p>

                  <label className="bot-field">
                    <span>Personality prompt</span>
                    <textarea
                      rows={5}
                      value={selected.personality_prompt}
                      onChange={(e) => updateSelected({ personality_prompt: e.target.value })}
                    />
                  </label>
                  </>
                  )}

                  <div className="bot-schedules">
                    <h3>Schedule (UTC)</h3>
                    <p className="bot-schedules-hint">
                      Click Save after changes. Active bots join their room immediately when scheduled.
                    </p>
                    <label className="bot-field-checkbox bot-schedule-mode">
                      <input
                        type="radio"
                        name={`schedule-mode-${selected.id}`}
                        checked={(selected.schedules?.length ?? 0) === 0}
                        onChange={() => updateSelected({ schedules: [] })}
                      />
                      <span>Always online (24/7 when bot is active)</span>
                    </label>
                    <label className="bot-field-checkbox bot-schedule-mode">
                      <input
                        type="radio"
                        name={`schedule-mode-${selected.id}`}
                        checked={(selected.schedules?.length ?? 0) > 0}
                        onChange={() =>
                          updateSelected({
                            schedules:
                              (selected.schedules?.length ?? 0) > 0
                                ? selected.schedules
                                : [emptySchedule()],
                          })
                        }
                      />
                      <span>Custom hours (use slots below)</span>
                    </label>
                    {(selected.schedules?.length ?? 0) > 0 && (
                      <button
                        type="button"
                        className="bot-add-slot-btn"
                        onClick={() =>
                          updateSelected({
                            schedules: [...(selected.schedules || []), emptySchedule()],
                          })
                        }
                      >
                        + Add time slot
                      </button>
                    )}
                    {(selected.schedules || []).map((slot, idx) => (
                      <div key={idx} className="bot-schedule-slot">
                        <div className="bot-weekdays">
                          {WEEKDAY_LABELS.map((label, day) => (
                            <label key={day}>
                              <input
                                type="checkbox"
                                checked={slot.weekdays.includes(day)}
                                onChange={(e) => {
                                  const weekdays = e.target.checked
                                    ? [...slot.weekdays, day].sort()
                                    : slot.weekdays.filter((d) => d !== day);
                                  const schedules = [...(selected.schedules || [])];
                                  schedules[idx] = { ...slot, weekdays };
                                  updateSelected({ schedules });
                                }}
                              />
                              {label}
                            </label>
                          ))}
                        </div>
                        <label>
                          From
                          <input
                            type="time"
                            value={slot.start_time}
                            onChange={(e) => {
                              const schedules = [...(selected.schedules || [])];
                              schedules[idx] = { ...slot, start_time: e.target.value };
                              updateSelected({ schedules });
                            }}
                          />
                        </label>
                        <label>
                          To
                          <input
                            type="time"
                            value={slot.end_time}
                            onChange={(e) => {
                              const schedules = [...(selected.schedules || [])];
                              schedules[idx] = { ...slot, end_time: e.target.value };
                              updateSelected({ schedules });
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          className="btn-remove-slot"
                          onClick={() => {
                            const schedules = (selected.schedules || []).filter((_, i) => i !== idx);
                            updateSelected({ schedules });
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
};

export default BotControlPage;
