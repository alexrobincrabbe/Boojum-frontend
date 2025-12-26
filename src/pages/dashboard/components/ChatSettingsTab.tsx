import { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import { dashboardAPI } from '../../../services/api';
import { Loading } from '../../../components/Loading';

interface ChatColorChoice {
  value: string;
  label: string;
}

interface ChatSettingsTabProps {
  bundle?: {
    chat_color?: string;
    chat_color_choices?: ChatColorChoice[];
    profanity_filter?: boolean;
  } | null;
}

const ChatSettingsTab = ({ bundle }: ChatSettingsTabProps) => {
  const [chatColor, setChatColor] = useState<string | null>(null); // Start as null, load from bundle
  const [chatColorChoices, setChatColorChoices] = useState<ChatColorChoice[]>([]);
  const [loading, setLoading] = useState(true);
  const isInitialMount = useRef(true);
  const initialChatColor = useRef<string | null>(null);

  useEffect(() => {
    const initFromBundle = () => {
      if (bundle && bundle.chat_color) {
        const fetchedColor = bundle.chat_color;
        setChatColor(fetchedColor);
        initialChatColor.current = fetchedColor;
        setChatColorChoices(bundle.chat_color_choices || []);
        isInitialMount.current = false;
        setLoading(false);
        return true;
      }
      return false;
    };

    if (initFromBundle()) return;

    const fetchData = async () => {
      try {
        const data = await dashboardAPI.getDashboardData();
        const fetchedColor = data.chat_color || '#E38614';
        setChatColor(fetchedColor);
        initialChatColor.current = fetchedColor;
        setChatColorChoices(data.chat_color_choices || []);
        isInitialMount.current = false;
      } catch (error: any) {
        // Silently handle 401 errors (unauthorized) - user shouldn't see this tab anyway
        if (error.response?.status === 401) {
          setLoading(false);
          isInitialMount.current = false;
          return;
        }
        console.error('Error fetching dashboard data:', error);
        toast.error('Error loading dashboard data');
        isInitialMount.current = false;
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [bundle]);

  // Auto-save when chat color changes (skip initial mount)
  useEffect(() => {
    if (isInitialMount.current || chatColor === null || chatColor === initialChatColor.current) {
      return;
    }
    
    const saveSettings = async () => {
      try {
        // Get current profanity filter from backend
        const currentProfanityFilter = bundle?.profanity_filter ?? true;
        await dashboardAPI.updateChatSettings(chatColor, currentProfanityFilter);
        initialChatColor.current = chatColor;
        toast.success('Chat color updated');
      } catch (error: any) {
        toast.error(error.response?.data?.error || 'Error updating chat color');
        // Revert on error
        setChatColor(initialChatColor.current);
      }
    };

    saveSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatColor]);


  const handleColorSelect = (colorValue: string) => {
    setChatColor(colorValue);
  };

  if (loading) {
    return (
      <div className="tab-content">
        <Loading minHeight="400px" />
      </div>
    );
  }

  return (
    <div className="tab-content">
      <div className="chat-content">
        <div id="chat-form">
          <label>Chat Color:</label>
          <div className="chat-color-list">
            {chatColorChoices.map((choice) => (
              <button
                key={choice.value}
                type="button"
                className={`chat-color-item ${chatColor === choice.value ? 'selected' : ''}`}
                onClick={() => handleColorSelect(choice.value)}
                style={{ color: choice.value }}
                disabled={chatColor === null}
              >
                {choice.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatSettingsTab;


