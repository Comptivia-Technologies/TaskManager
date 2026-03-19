import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import MemberDetail from '../../pages/MemberDetail';

jest.mock('../../services/memberService', () => ({
  memberService: { getById: jest.fn().mockRejectedValue(new Error('not found')) },
}));

describe('MemberDetail', () => {
  it('renders without crashing', () => {
    render(
      <MemoryRouter initialEntries={['/members/1']}>
        <Routes>
          <Route path="/members/:id" element={<MemberDetail />} />
        </Routes>
      </MemoryRouter>
    );
    expect(document.body).toBeInTheDocument();
  });
});
