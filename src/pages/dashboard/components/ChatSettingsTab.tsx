import { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import { dashboardAPI } from '../../../services/api';

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
  const [chatColor, setChatColor] = useState('#E38614');
  const [chatColorChoices, setChatColorChoices] = useState<ChatColorChoice[]>([]);
  const [loading, setLoading] = useState(true);
  const isInitialMount = useRef(true);
  const initialChatColor = useRef('#E38614');

  useEffect(() => {
    const initFromBundle = () => {
      if (bundle) {
        const fetchedColor = bundle.chat_color || '#E38614';
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
      } catch (error) {
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
    if (isInitialMount.current || chatColor === initialChatColor.current) {
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
        <div className="dashboard-loading">
          <img src="/images/loading.gif" alt="Loading..." className="loading-gif" />
        </div>
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


