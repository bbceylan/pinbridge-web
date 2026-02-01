import { notificationService } from '../notifications';
import { toast } from '@/components/ui/use-toast';
import type { LinkList } from '@/types';

// Mock the toast function
jest.mock('@/components/ui/use-toast', () => ({
  toast: jest.fn(),
}));

const mockToast = toast as jest.MockedFunction<typeof toast>;

describe('NotificationService', () => {
  beforeEach(() => {
    mockToast.mockClear();
  });

  const createMockLinkList = (id: string, title: string): LinkList => ({
    id,
    title,
    description: undefined,
    placeIds: [],
    collectionIds: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    isPublic: true,
  });

  describe('notifyLinkListsAffectedByPlaceDeletion', () => {
    it('should not show notification when no Link Lists are affected', () => {
      // Act
      notificationService.notifyLinkListsAffectedByPlaceDeletion(
        'Test Place',
        [],
        []
      );

      // Assert
      expect(mockToast).not.toHaveBeenCalled();
    });

    it('should show notification for updated Link Lists only', () => {
      // Arrange
      const updatedLinkLists = [
        createMockLinkList('1', 'List 1'),
        createMockLinkList('2', 'List 2'),
      ];

      // Act
      notificationService.notifyLinkListsAffectedByPlaceDeletion(
        'Test Place',
        updatedLinkLists,
        []
      );

      // Assert
      expect(mockToast).toHaveBeenCalledWith({
        title: '2 Link Lists updated',
        description: 'Deleted "Test Place": "List 1", "List 2" were updated.',
        variant: 'default',
      });
    });

    it('should show notification for deleted Link Lists only', () => {
      // Arrange
      const deletedLinkLists = [createMockLinkList('1', 'List 1')];

      // Act
      notificationService.notifyLinkListsAffectedByPlaceDeletion(
        'Test Place',
        [],
        deletedLinkLists
      );

      // Assert
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Link List removed',
        description: 'Deleted "Test Place": "List 1" was removed.',
        variant: 'default',
      });
    });

    it('should show notification for both updated and deleted Link Lists', () => {
      // Arrange
      const updatedLinkLists = [createMockLinkList('1', 'Updated List')];
      const deletedLinkLists = [createMockLinkList('2', 'Deleted List')];

      // Act
      notificationService.notifyLinkListsAffectedByPlaceDeletion(
        'Test Place',
        updatedLinkLists,
        deletedLinkLists
      );

      // Assert
      expect(mockToast).toHaveBeenCalledWith({
        title: '2 Link Lists affected',
        description: 'Deleted "Test Place": 1 Link Lists removed, 1 updated.',
        variant: 'default',
      });
    });

    it('should handle single vs plural correctly', () => {
      // Arrange
      const updatedLinkLists = [createMockLinkList('1', 'Single List')];

      // Act
      notificationService.notifyLinkListsAffectedByPlaceDeletion(
        'Test Place',
        updatedLinkLists,
        []
      );

      // Assert
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Link List updated',
        description: 'Deleted "Test Place": "Single List" was updated.',
        variant: 'default',
      });
    });
  });

  describe('notifyLinkListsAffectedByCollectionDeletion', () => {
    it('should not show notification when no Link Lists are affected', () => {
      // Act
      notificationService.notifyLinkListsAffectedByCollectionDeletion(
        'Test Collection',
        [],
        []
      );

      // Assert
      expect(mockToast).not.toHaveBeenCalled();
    });

    it('should show notification for collection deletion', () => {
      // Arrange
      const updatedLinkLists = [createMockLinkList('1', 'Updated List')];

      // Act
      notificationService.notifyLinkListsAffectedByCollectionDeletion(
        'Test Collection',
        updatedLinkLists,
        []
      );

      // Assert
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Link List updated',
        description: 'Deleted collection "Test Collection": "Updated List" was updated.',
        variant: 'default',
      });
    });

    it('should show notification for deleted Link Lists from collection deletion', () => {
      // Arrange
      const deletedLinkLists = [
        createMockLinkList('1', 'List 1'),
        createMockLinkList('2', 'List 2'),
      ];

      // Act
      notificationService.notifyLinkListsAffectedByCollectionDeletion(
        'Test Collection',
        [],
        deletedLinkLists
      );

      // Assert
      expect(mockToast).toHaveBeenCalledWith({
        title: '2 Link Lists removed',
        description: 'Deleted collection "Test Collection": "List 1", "List 2" were removed.',
        variant: 'default',
      });
    });
  });
});