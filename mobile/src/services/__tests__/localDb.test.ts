const mockRunAsync = jest.fn().mockResolvedValue({ lastInsertRowId: 1, changes: 1 });
const mockGetAllAsync = jest.fn().mockResolvedValue([]);
const mockExecAsync = jest.fn().mockResolvedValue(undefined);

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn().mockResolvedValue({
    runAsync: mockRunAsync,
    getAllAsync: mockGetAllAsync,
    execAsync: mockExecAsync,
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('localDb', () => {
  describe('getDb', () => {
    it('initializes the database with WAL mode and creates tables', async () => {
      jest.resetModules();

      const SQLite = require('expo-sqlite');
      const db = { runAsync: mockRunAsync, getAllAsync: mockGetAllAsync, execAsync: mockExecAsync };
      SQLite.openDatabaseAsync.mockResolvedValue(db);

      const { getDb } = require('../localDb');
      const result = await getDb();

      expect(SQLite.openDatabaseAsync).toHaveBeenCalledWith('battlebuddy');
      expect(db.execAsync).toHaveBeenCalledTimes(1);
      const schema = db.execAsync.mock.calls[0][0] as string;
      expect(schema).toContain('PRAGMA journal_mode = WAL');
      expect(schema).toContain('CREATE TABLE IF NOT EXISTS messages');
      expect(schema).toContain('CREATE TABLE IF NOT EXISTS craving_events');
      expect(result).toBe(db);
    });
  });

  describe('insertMessage', () => {
    it('inserts a message with synced = 0', async () => {
      jest.resetModules();
      const SQLite = require('expo-sqlite');
      SQLite.openDatabaseAsync.mockResolvedValue({
        runAsync: mockRunAsync,
        getAllAsync: mockGetAllAsync,
        execAsync: mockExecAsync,
      });

      const { insertMessage } = require('../localDb');
      await insertMessage({
        id: 'msg-1',
        session_id: 'session-1',
        role: 'user',
        content: 'test message',
        mode: 'text',
        timestamp: 1000,
      });

      expect(mockRunAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO messages'),
        'msg-1', 'session-1', 'user', 'test message', 'text', 1000,
      );
    });
  });

  describe('updateMessageContent', () => {
    it('updates content and resets synced to 0', async () => {
      jest.resetModules();
      const SQLite = require('expo-sqlite');
      SQLite.openDatabaseAsync.mockResolvedValue({
        runAsync: mockRunAsync,
        getAllAsync: mockGetAllAsync,
        execAsync: mockExecAsync,
      });

      const { updateMessageContent } = require('../localDb');
      await updateMessageContent('msg-1', 'updated content');

      expect(mockRunAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE messages SET content'),
        'updated content', 'msg-1',
      );
    });
  });

  describe('getUnsyncedMessages', () => {
    it('queries for synced = 0 ordered by timestamp', async () => {
      jest.resetModules();
      const SQLite = require('expo-sqlite');
      SQLite.openDatabaseAsync.mockResolvedValue({
        runAsync: mockRunAsync,
        getAllAsync: mockGetAllAsync,
        execAsync: mockExecAsync,
      });

      const { getUnsyncedMessages } = require('../localDb');
      await getUnsyncedMessages();

      expect(mockGetAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('WHERE synced = 0'),
      );
    });
  });

  describe('markMessagesSynced', () => {
    it('marks multiple messages as synced', async () => {
      jest.resetModules();
      const SQLite = require('expo-sqlite');
      SQLite.openDatabaseAsync.mockResolvedValue({
        runAsync: mockRunAsync,
        getAllAsync: mockGetAllAsync,
        execAsync: mockExecAsync,
      });

      const { markMessagesSynced } = require('../localDb');
      await markMessagesSynced(['msg-1', 'msg-2']);

      expect(mockRunAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE messages SET synced = 1'),
        'msg-1', 'msg-2',
      );
    });

    it('does nothing for empty array', async () => {
      jest.resetModules();
      const SQLite = require('expo-sqlite');
      SQLite.openDatabaseAsync.mockResolvedValue({
        runAsync: mockRunAsync,
        getAllAsync: mockGetAllAsync,
        execAsync: mockExecAsync,
      });
      mockRunAsync.mockClear();

      const { markMessagesSynced } = require('../localDb');
      await markMessagesSynced([]);
      expect(mockRunAsync).not.toHaveBeenCalled();
    });
  });

  describe('insertCravingEvent', () => {
    it('inserts an event with synced = 0', async () => {
      jest.resetModules();
      const SQLite = require('expo-sqlite');
      SQLite.openDatabaseAsync.mockResolvedValue({
        runAsync: mockRunAsync,
        getAllAsync: mockGetAllAsync,
        execAsync: mockExecAsync,
      });

      const { insertCravingEvent } = require('../localDb');
      await insertCravingEvent({
        id: 'event-1',
        user_id: 'user-1',
        started_at: 1000,
        ended_at: null,
        mode: 'text',
        outcome: null,
        helped: null,
        intensity_start: 7,
        intensity_end: null,
        trigger_context: null,
      });

      expect(mockRunAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO craving_events'),
        'event-1', 'user-1', 1000, null, 'text', null, null, 7, null, null,
      );
    });
  });

  describe('updateCravingEvent', () => {
    it('updates specified fields and resets synced', async () => {
      jest.resetModules();
      const SQLite = require('expo-sqlite');
      SQLite.openDatabaseAsync.mockResolvedValue({
        runAsync: mockRunAsync,
        getAllAsync: mockGetAllAsync,
        execAsync: mockExecAsync,
      });

      const { updateCravingEvent } = require('../localDb');
      await updateCravingEvent('event-1', { outcome: 'resisted', ended_at: 2000 });

      expect(mockRunAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE craving_events SET'),
        2000, 'resisted', 'event-1',
      );
    });

    it('does nothing when no fields provided', async () => {
      jest.resetModules();
      const SQLite = require('expo-sqlite');
      SQLite.openDatabaseAsync.mockResolvedValue({
        runAsync: mockRunAsync,
        getAllAsync: mockGetAllAsync,
        execAsync: mockExecAsync,
      });
      mockRunAsync.mockClear();

      const { updateCravingEvent } = require('../localDb');
      await updateCravingEvent('event-1', {});
      expect(mockRunAsync).not.toHaveBeenCalled();
    });
  });

  describe('markEventsSynced', () => {
    it('marks multiple events as synced', async () => {
      jest.resetModules();
      const SQLite = require('expo-sqlite');
      SQLite.openDatabaseAsync.mockResolvedValue({
        runAsync: mockRunAsync,
        getAllAsync: mockGetAllAsync,
        execAsync: mockExecAsync,
      });

      const { markEventsSynced } = require('../localDb');
      await markEventsSynced(['event-1', 'event-2']);

      expect(mockRunAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE craving_events SET synced = 1'),
        'event-1', 'event-2',
      );
    });
  });

  describe('getSessionMessages', () => {
    it('queries messages by session_id', async () => {
      jest.resetModules();
      const SQLite = require('expo-sqlite');
      SQLite.openDatabaseAsync.mockResolvedValue({
        runAsync: mockRunAsync,
        getAllAsync: mockGetAllAsync,
        execAsync: mockExecAsync,
      });

      const { getSessionMessages } = require('../localDb');
      await getSessionMessages('session-1');

      expect(mockGetAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('WHERE session_id = ?'),
        'session-1',
      );
    });
  });
});
