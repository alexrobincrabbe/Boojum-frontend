import React from 'react';
import Doodledum from './components/Doodledum';
import './MinigamesPage.css';

const DoodledumPage: React.FC = () => {
  return (
    <div className="minigames-page">
      <div className="container-fluid">
        <div className="row">
          <div className="col-12">
            <Doodledum />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DoodledumPage;

