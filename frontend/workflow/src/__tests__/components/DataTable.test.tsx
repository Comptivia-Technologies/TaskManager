import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import DataTable, { Column } from '../../components/DataTable';

interface Row { id: string; name: string; due: number }

const rows: Row[] = [
  { id: 'b', name: 'Beta', due: 2 },
  { id: 'a', name: 'Alpha', due: 3 },
  { id: 'c', name: 'Gamma', due: 1 },
];

const columns: Column<Row>[] = [
  { key: 'name', header: 'Enquiry', render: (r) => r.name, sortValue: (r) => r.name },
  { key: 'due', header: 'Due', render: (r) => String(r.due), sortValue: (r) => r.due },
];

const names = () =>
  screen.getAllByRole('row').slice(1).map((row) => row.querySelectorAll('td')[0].textContent);

describe('DataTable', () => {
  it('sorts ascending then descending on the chosen column', () => {
    render(<DataTable caption="Enquiries" columns={columns} rows={rows} rowKey={(r) => r.id} />);

    fireEvent.click(screen.getByRole('button', { name: /Enquiry/ }));
    expect(names()).toEqual(['Alpha', 'Beta', 'Gamma']);

    fireEvent.click(screen.getByRole('button', { name: /Enquiry/ }));
    expect(names()).toEqual(['Gamma', 'Beta', 'Alpha']);
  });

  it('reports sort direction to assistive tech', () => {
    render(<DataTable caption="Enquiries" columns={columns} rows={rows} rowKey={(r) => r.id} />);
    fireEvent.click(screen.getByRole('button', { name: /Due/ }));
    expect(screen.getByRole('columnheader', { name: /Due/ })).toHaveAttribute('aria-sort', 'ascending');
  });

  it('shows the empty state instead of an empty table', () => {
    render(
      <DataTable
        caption="Enquiries"
        columns={columns}
        rows={[]}
        rowKey={(r) => r.id}
        empty={<p>Nothing here</p>}
      />
    );
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('opens a row with the keyboard, not only the mouse', () => {
    const onRowClick = jest.fn();
    render(
      <DataTable caption="Enquiries" columns={columns} rows={rows} rowKey={(r) => r.id} onRowClick={onRowClick} />
    );
    fireEvent.keyDown(screen.getAllByRole('row')[1], { key: 'Enter' });
    expect(onRowClick).toHaveBeenCalled();
  });

  it('announces loading and reserves the rows', () => {
    render(<DataTable caption="Enquiries" columns={columns} rows={[]} rowKey={(r) => r.id} loading />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading Enquiries');
  });
});
