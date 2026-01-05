import SavedBoardsTab from '../dashboard/components/SavedBoardsTab';
import './SavedBoardsPage.css';

const SavedBoardsPage = () => {
  return (
    <div style={{ minHeight: 'calc(100vh - 70px)', padding: '20px', backgroundColor: '#1b1835', backgroundImage: 'linear-gradient(transparent, 50%, black)' }}>
      <SavedBoardsTab />
    </div>
  );
};

export default SavedBoardsPage;

