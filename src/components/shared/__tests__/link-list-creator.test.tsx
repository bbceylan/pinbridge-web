/**
 * Unit tests for LinkListCreator component edge cases
 * Tests empty collection handling, empty place selection, and boundary conditions
 * Requirements: 1.5, 4.5
 */

import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LinkListCreator } from '../link-list-creator';
import { db } from '@/lib/db';
import { linkListService } from '@/lib/services/link-list';
import { generateId } from '@/lib/utils';
import type { Place, Collection } from '@/types';

// Mock the link list service
jest.mock('@/lib/services/link-list');
const mockLinkListService = linkListService as jest.Mocked<typeof linkListService>;

// Test setup and teardown
beforeEach(async () => {
  await db.delete();
  await db.open();
  jest.clearAllMocks();
  cleanup();
  
  // Setup default mock implementations
  mockLinkListService.createLinkList.mockImplementation(async (data) => ({
    id: generateId(),
    title: data.title,
    description: data.description,
    placeIds: data.selectedPlaces.map(p => p.id),
    collectionIds: data.selectedCollections.map(c => c.id),
    createdAt: new Date(),
    updatedAt: new Date(),
    isPublic: true,
  }));
});

afterEach(async () => {
  await db.close();
  jest.restoreAllMocks();
  cleanup();
});

describe('LinkListCreator Edge Cases', () => {
  describe('Empty Collection Handling', () => {
    it('should handle empty collections gracefully', async () => {
      // Setup: Create collections with no places
      const emptyCollection: Collection = {
        id: generateId(),
        name: 'Empty Collection',
        description: 'A collection with no places',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.collections.add(emptyCollection);

      const user = userEvent.setup();
      const mockOnLinkListCreated = jest.fn();

      render(
        <LinkListCreator onLinkListCreated={mockOnLinkListCreated} />
      );

      // Wait for data to load
      await waitFor(() => {
        expect(screen.getByText('Empty Collection')).toBeInTheDocument();
      });

      // Select the empty collection
      const collectionCheckbox = screen.getByLabelText('Empty Collection');
      await user.click(collectionCheckbox);

      // Verify collection is selected but no places are shown
      expect(collectionCheckbox).toBeChecked();
      expect(screen.getByText('Places included')).toBeInTheDocument();
      const placesIncludedSection = screen.getByText('Places included').closest('div');
      expect(placesIncludedSection).toHaveTextContent('0');

      // Try to create link list with empty collection
      const titleInput = screen.getByLabelText('Title');
      await user.type(titleInput, 'Test Empty Collection');

      const createButton = screen.getByRole('button', { name: /create link list/i });
      expect(createButton).toBeDisabled(); // Should be disabled due to no places

      // Verify no service call was made since button is disabled
      expect(mockLinkListService.createLinkList).not.toHaveBeenCalled();
      expect(mockOnLinkListCreated).not.toHaveBeenCalled();
    });

    it('should show correct place count for empty collections', async () => {
      const emptyCollection: Collection = {
        id: generateId(),
        name: 'Empty Collection',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.collections.add(emptyCollection);

      render(<LinkListCreator />);

      await waitFor(() => {
        expect(screen.getByText('Empty Collection')).toBeInTheDocument();
        expect(screen.getByText('0 places')).toBeInTheDocument();
      });
    });

    it('should handle collections that become empty after place deletion', async () => {
      // Setup: Create collection with a place, then remove the place
      const collection: Collection = {
        id: generateId(),
        name: 'Soon Empty Collection',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const place: Place = {
        id: generateId(),
        title: 'Test Place',
        address: '123 Test St',
        latitude: 40.7128,
        longitude: -74.0060,
        notes: '',
        tags: [],
        source: 'manual',
        normalizedTitle: 'test place',
        normalizedAddress: '123 test st',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.collections.add(collection);
      await db.places.add(place);
      await db.placeCollections.add({
        id: generateId(),
        placeId: place.id,
        collectionId: collection.id,
      });

      render(<LinkListCreator />);

      // Initially should show 1 place
      await waitFor(() => {
        expect(screen.getByText('Soon Empty Collection')).toBeInTheDocument();
        expect(screen.getByText('1 place')).toBeInTheDocument();
      });

      // Simulate place deletion (this would happen in real app)
      await db.placeCollections.where('placeId').equals(place.id).delete();
      await db.places.delete(place.id);

      // Re-render to see updated state
      cleanup();
      render(<LinkListCreator />);

      await waitFor(() => {
        expect(screen.getByText('Soon Empty Collection')).toBeInTheDocument();
        expect(screen.getByText('0 places')).toBeInTheDocument();
      });
    });
  });

  describe('Empty Place Selection', () => {
    it('should prevent link list creation with no places selected', async () => {
      // Setup: Create some places but don't select any
      const place: Place = {
        id: generateId(),
        title: 'Unselected Place',
        address: '123 Test St',
        latitude: 40.7128,
        longitude: -74.0060,
        notes: '',
        tags: [],
        source: 'manual',
        normalizedTitle: 'unselected place',
        normalizedAddress: '123 test st',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.places.add(place);

      const user = userEvent.setup();
      const mockOnLinkListCreated = jest.fn();

      render(
        <LinkListCreator onLinkListCreated={mockOnLinkListCreated} />
      );

      await waitFor(() => {
        expect(screen.getByText('Unselected Place')).toBeInTheDocument();
      });

      // Enter title but don't select any places
      const titleInput = screen.getByLabelText('Title');
      await user.type(titleInput, 'Test No Places');

      // Verify summary shows 0 places
      expect(screen.getByText('Places included')).toBeInTheDocument();
      const placesIncludedSection = screen.getByText('Places included').closest('div');
      expect(placesIncludedSection).toHaveTextContent('0');

      // Create button should be disabled
      const createButton = screen.getByRole('button', { name: /create link list/i });
      expect(createButton).toBeDisabled();

      // Verify no service call was made since button is disabled
      expect(mockLinkListService.createLinkList).not.toHaveBeenCalled();
      expect(mockOnLinkListCreated).not.toHaveBeenCalled();
    });

    it('should require title even with places selected', async () => {
      const place: Place = {
        id: generateId(),
        title: 'Test Place',
        address: '123 Test St',
        latitude: 40.7128,
        longitude: -74.0060,
        notes: '',
        tags: [],
        source: 'manual',
        normalizedTitle: 'test place',
        normalizedAddress: '123 test st',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.places.add(place);

      const user = userEvent.setup();
      const mockOnLinkListCreated = jest.fn();

      render(
        <LinkListCreator onLinkListCreated={mockOnLinkListCreated} />
      );

      await waitFor(() => {
        expect(screen.getByText('Test Place')).toBeInTheDocument();
      });

      // Select place but don't enter title
      const placeCheckbox = screen.getByLabelText('Test Place');
      await user.click(placeCheckbox);

      expect(screen.getByText('Places included')).toBeInTheDocument();
      expect(screen.getByText('Places included').parentElement?.textContent).toContain('1');

      // Create button should still be disabled due to missing title
      const createButton = screen.getByRole('button', { name: /create link list/i });
      expect(createButton).toBeDisabled();

      // Verify no service call was made since button is disabled
      expect(mockLinkListService.createLinkList).not.toHaveBeenCalled();
    });

    it('should handle whitespace-only titles', async () => {
      const place: Place = {
        id: generateId(),
        title: 'Test Place',
        address: '123 Test St',
        latitude: 40.7128,
        longitude: -74.0060,
        notes: '',
        tags: [],
        source: 'manual',
        normalizedTitle: 'test place',
        normalizedAddress: '123 test st',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.places.add(place);

      const user = userEvent.setup();
      render(<LinkListCreator />);

      await waitFor(() => {
        expect(screen.getByText('Test Place')).toBeInTheDocument();
      });

      // Select place and enter whitespace-only title
      const placeCheckbox = screen.getByLabelText('Test Place');
      await user.click(placeCheckbox);

      const titleInput = screen.getByLabelText('Title');
      await user.type(titleInput, '   '); // Only spaces

      // Create button should be disabled
      const createButton = screen.getByRole('button', { name: /create link list/i });
      expect(createButton).toBeDisabled();

      // Verify no service call was made since button is disabled
      expect(mockLinkListService.createLinkList).not.toHaveBeenCalled();
    });
  });

  describe('Boundary Conditions', () => {
    it('should handle database loading states gracefully', async () => {
      // Render before database is populated
      render(<LinkListCreator />);

      // Should show loading state or empty state gracefully
      expect(screen.getByText('Link List Details')).toBeInTheDocument();
      expect(screen.getByText('Places included')).toBeInTheDocument();
      const placesIncludedSection = screen.getByText('Places included').closest('div');
      expect(placesIncludedSection).toHaveTextContent('0');

      // Create button should be disabled
      const createButton = screen.getByRole('button', { name: /create link list/i });
      expect(createButton).toBeDisabled();
    });

    it('should handle places with missing or invalid data', async () => {
      // Create places with edge case data
      const placesWithEdgeCases: Place[] = [
        {
          id: generateId(),
          title: '', // Empty title
          address: '123 Test St',
          latitude: 40.7128,
          longitude: -74.0060,
          notes: '',
          tags: [],
          source: 'manual',
          normalizedTitle: '',
          normalizedAddress: '123 test st',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: generateId(),
          title: 'Place with Empty Address',
          address: '', // Empty address
          latitude: 40.7128,
          longitude: -74.0060,
          notes: '',
          tags: [],
          source: 'manual',
          normalizedTitle: 'place with empty address',
          normalizedAddress: '',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: generateId(),
          title: 'Place with No Coordinates',
          address: '456 Test Ave',
          latitude: undefined, // No coordinates
          longitude: undefined,
          notes: '',
          tags: [],
          source: 'manual',
          normalizedTitle: 'place with no coordinates',
          normalizedAddress: '456 test ave',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      await db.places.bulkAdd(placesWithEdgeCases);

      render(<LinkListCreator />);

      // Should render all places even with missing data
      await waitFor(() => {
        // Empty title should still be selectable (component should handle gracefully)
        expect(screen.getByText('Place with Empty Address')).toBeInTheDocument();
        expect(screen.getByText('Place with No Coordinates')).toBeInTheDocument();
      });

      // All places should be selectable
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBeGreaterThanOrEqual(3); // At least the 3 places
    });

    it('should handle very long titles and descriptions', async () => {
      const place: Place = {
        id: generateId(),
        title: 'Test Place',
        address: '123 Test St',
        latitude: 40.7128,
        longitude: -74.0060,
        notes: '',
        tags: [],
        source: 'manual',
        normalizedTitle: 'test place',
        normalizedAddress: '123 test st',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.places.add(place);

      const user = userEvent.setup();
      const mockOnLinkListCreated = jest.fn();

      render(
        <LinkListCreator onLinkListCreated={mockOnLinkListCreated} />
      );

      await waitFor(() => {
        expect(screen.getByText('Test Place')).toBeInTheDocument();
      });

      // Select place
      const placeCheckbox = screen.getByLabelText('Test Place');
      await user.click(placeCheckbox);

      // Enter moderately long title and description
      const longTitle = 'A'.repeat(100); // Moderately long title
      const longDescription = 'B'.repeat(200); // Moderately long description

      const titleInput = screen.getByLabelText('Title');
      const descriptionInput = screen.getByLabelText('Description (optional)');

      await user.clear(titleInput);
      await user.type(titleInput, longTitle);
      await user.clear(descriptionInput);
      await user.type(descriptionInput, longDescription);

      // Should still be able to create
      const createButton = screen.getByRole('button', { name: /create link list/i });
      expect(createButton).not.toBeDisabled();

      await user.click(createButton);

      await waitFor(() => {
        expect(mockLinkListService.createLinkList).toHaveBeenCalledWith({
          title: longTitle,
          description: longDescription,
          selectedPlaces: [expect.objectContaining({ id: place.id })],
          selectedCollections: [],
        });
      });
    });

    it('should handle service errors gracefully', async () => {
      const place: Place = {
        id: generateId(),
        title: 'Test Place',
        address: '123 Test St',
        latitude: 40.7128,
        longitude: -74.0060,
        notes: '',
        tags: [],
        source: 'manual',
        normalizedTitle: 'test place',
        normalizedAddress: '123 test st',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.places.add(place);

      // Mock service to throw error
      mockLinkListService.createLinkList.mockRejectedValue(new Error('Database error'));

      const user = userEvent.setup();
      const mockOnLinkListCreated = jest.fn();

      render(
        <LinkListCreator onLinkListCreated={mockOnLinkListCreated} />
      );

      await waitFor(() => {
        expect(screen.getByText('Test Place')).toBeInTheDocument();
      });

      // Select place and enter title
      const placeCheckbox = screen.getByLabelText('Test Place');
      await user.click(placeCheckbox);

      const titleInput = screen.getByLabelText('Title');
      await user.type(titleInput, 'Test Title');

      // Try to create
      const createButton = screen.getByRole('button', { name: /create link list/i });
      await user.click(createButton);

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/failed to create link list/i)).toBeInTheDocument();
      });

      // Should not call success callback
      expect(mockOnLinkListCreated).not.toHaveBeenCalled();

      // Button should be enabled again for retry
      expect(createButton).not.toBeDisabled();
    });

    it('should handle rapid selection/deselection without errors', async () => {
      const places: Place[] = Array.from({ length: 5 }, (_, i) => ({
        id: generateId(),
        title: `Place ${i + 1}`,
        address: `${i + 1}23 Test St`,
        latitude: 40.7128 + i * 0.001,
        longitude: -74.0060 + i * 0.001,
        notes: '',
        tags: [],
        source: 'manual',
        normalizedTitle: `place ${i + 1}`,
        normalizedAddress: `${i + 1}23 test st`,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      await db.places.bulkAdd(places);

      const user = userEvent.setup();
      render(<LinkListCreator />);

      await waitFor(() => {
        expect(screen.getByText('Place 1')).toBeInTheDocument();
      });

      // Rapidly select and deselect places
      for (let i = 0; i < 3; i++) {
        const checkbox1 = screen.getByLabelText('Place 1');
        const checkbox2 = screen.getByLabelText('Place 2');
        const checkbox3 = screen.getByLabelText('Place 3');

        await user.click(checkbox1);
        await user.click(checkbox2);
        await user.click(checkbox3);
        await user.click(checkbox1); // Deselect
        await user.click(checkbox2); // Deselect
        await user.click(checkbox3); // Deselect
      }

      // Should end up with 0 places selected
      expect(screen.getByText('Places included')).toBeInTheDocument();
      const placesIncludedSection = screen.getByText('Places included').closest('div');
      expect(placesIncludedSection).toHaveTextContent('0');
    });
  });

  describe('Default Title Generation', () => {
    it('should generate appropriate default titles for different selection scenarios', async () => {
      const collection1: Collection = {
        id: generateId(),
        name: 'Restaurants',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const collection2: Collection = {
        id: generateId(),
        name: 'Parks',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const collection3: Collection = {
        id: generateId(),
        name: 'Museums',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const place: Place = {
        id: generateId(),
        title: 'Individual Place',
        address: '123 Test St',
        latitude: 40.7128,
        longitude: -74.0060,
        notes: '',
        tags: [],
        source: 'manual',
        normalizedTitle: 'individual place',
        normalizedAddress: '123 test st',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.collections.bulkAdd([collection1, collection2, collection3]);
      await db.places.add(place);

      const user = userEvent.setup();
      render(<LinkListCreator />);

      await waitFor(() => {
        expect(screen.getByText('Restaurants')).toBeInTheDocument();
      });

      // Test single collection selection
      const restaurantsCheckbox = screen.getByLabelText('Restaurants');
      await user.click(restaurantsCheckbox);

      const titleInput = screen.getByLabelText('Title') as HTMLInputElement;
      expect(titleInput.placeholder).toBe('Restaurants');

      // Test two collections
      await user.click(restaurantsCheckbox); // Deselect
      const parksCheckbox = screen.getByLabelText('Parks');
      await user.click(restaurantsCheckbox); // Select restaurants
      await user.click(parksCheckbox); // Select parks

      expect(titleInput.placeholder).toBe('Parks & Restaurants');

      // Test three collections
      const museumsCheckbox = screen.getByLabelText('Museums');
      await user.click(museumsCheckbox);

      expect(titleInput.placeholder).toBe('Museums, Parks & Restaurants');

      // Test individual place only
      await user.click(restaurantsCheckbox); // Deselect all collections
      await user.click(parksCheckbox);
      await user.click(museumsCheckbox);

      const placeCheckbox = screen.getByLabelText('Individual Place');
      await user.click(placeCheckbox);

      expect(titleInput.placeholder).toBe('1 Selected Places');
    });
  });
});