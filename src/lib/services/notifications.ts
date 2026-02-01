import { toast } from '@/components/ui/use-toast';
import type { LinkList } from '@/types';

export interface NotificationService {
  notifyLinkListsAffectedByPlaceDeletion(
    placeName: string,
    updatedLinkLists: LinkList[],
    deletedLinkLists: LinkList[]
  ): void;
  notifyLinkListsAffectedByCollectionDeletion(
    collectionName: string,
    updatedLinkLists: LinkList[],
    deletedLinkLists: LinkList[]
  ): void;
}

class NotificationServiceImpl implements NotificationService {
  notifyLinkListsAffectedByPlaceDeletion(
    placeName: string,
    updatedLinkLists: LinkList[],
    deletedLinkLists: LinkList[]
  ): void {
    const totalAffected = updatedLinkLists.length + deletedLinkLists.length;
    
    if (totalAffected === 0) {
      return; // No Link Lists were affected
    }
    
    let title: string;
    let description: string;
    
    if (deletedLinkLists.length > 0 && updatedLinkLists.length > 0) {
      // Both updated and deleted
      title = `${totalAffected} Link Lists affected`;
      description = `Deleted "${placeName}": ${deletedLinkLists.length} Link Lists removed, ${updatedLinkLists.length} updated.`;
    } else if (deletedLinkLists.length > 0) {
      // Only deleted
      title = deletedLinkLists.length === 1 ? 'Link List removed' : `${deletedLinkLists.length} Link Lists removed`;
      description = `Deleted "${placeName}": ${deletedLinkLists.map(ll => `"${ll.title}"`).join(', ')} ${deletedLinkLists.length === 1 ? 'was' : 'were'} removed.`;
    } else {
      // Only updated
      title = updatedLinkLists.length === 1 ? 'Link List updated' : `${updatedLinkLists.length} Link Lists updated`;
      description = `Deleted "${placeName}": ${updatedLinkLists.map(ll => `"${ll.title}"`).join(', ')} ${updatedLinkLists.length === 1 ? 'was' : 'were'} updated.`;
    }
    
    toast({
      title,
      description,
      variant: 'default',
    });
  }
  
  notifyLinkListsAffectedByCollectionDeletion(
    collectionName: string,
    updatedLinkLists: LinkList[],
    deletedLinkLists: LinkList[]
  ): void {
    const totalAffected = updatedLinkLists.length + deletedLinkLists.length;
    
    if (totalAffected === 0) {
      return; // No Link Lists were affected
    }
    
    let title: string;
    let description: string;
    
    if (deletedLinkLists.length > 0 && updatedLinkLists.length > 0) {
      // Both updated and deleted
      title = `${totalAffected} Link Lists affected`;
      description = `Deleted collection "${collectionName}": ${deletedLinkLists.length} Link Lists removed, ${updatedLinkLists.length} updated.`;
    } else if (deletedLinkLists.length > 0) {
      // Only deleted
      title = deletedLinkLists.length === 1 ? 'Link List removed' : `${deletedLinkLists.length} Link Lists removed`;
      description = `Deleted collection "${collectionName}": ${deletedLinkLists.map(ll => `"${ll.title}"`).join(', ')} ${deletedLinkLists.length === 1 ? 'was' : 'were'} removed.`;
    } else {
      // Only updated
      title = updatedLinkLists.length === 1 ? 'Link List updated' : `${updatedLinkLists.length} Link Lists updated`;
      description = `Deleted collection "${collectionName}": ${updatedLinkLists.map(ll => `"${ll.title}"`).join(', ')} ${updatedLinkLists.length === 1 ? 'was' : 'were'} updated.`;
    }
    
    toast({
      title,
      description,
      variant: 'default',
    });
  }
}

// Export singleton instance
export const notificationService = new NotificationServiceImpl();