import { useSnackbar } from '@/components/Snackbar';
import { useReceipts } from '@/features/receipts/receiptsStore';
import { changeStatusWithUndo, UNDO_MS, undoStatus } from '@/features/receipts/statusActions';
import { firestoreWrites, resetFirestore, seedDoc } from '@/test/firebase';

const PATH = 'users/u1/receipts/r1';

beforeEach(() => {
  jest.useFakeTimers();
  resetFirestore();
  seedDoc(PATH, { status: 'active' });
  useReceipts.getState().reset('u1');
  useSnackbar.setState({ current: null });
});

afterEach(() => jest.useRealTimers());

describe('status change with Undo', () => {
  it('shows the new status at once but saves only when the 5-second window ends', () => {
    changeStatusWithUndo('u1', 'r1', 'returned');
    expect(useReceipts.getState().pendingStatus).toEqual({ r1: 'returned' });
    expect(useSnackbar.getState().current).toMatchObject({
      message: 'Marked as returned',
      actionLabel: 'Undo',
    });

    jest.advanceTimersByTime(UNDO_MS - 1);
    expect(firestoreWrites).toHaveLength(0);
    jest.advanceTimersByTime(1);
    expect(firestoreWrites).toEqual([
      expect.objectContaining({
        op: 'update',
        path: PATH,
        value: expect.objectContaining({ status: 'returned' }),
      }),
    ]);
  });

  it('Undo cancels the change without writing anything', () => {
    changeStatusWithUndo('u1', 'r1', 'kept');
    undoStatus('r1');
    jest.advanceTimersByTime(UNDO_MS * 2);
    expect(firestoreWrites).toHaveLength(0);
    expect(useReceipts.getState().pendingStatus).toEqual({});
  });
});
