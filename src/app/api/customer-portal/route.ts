import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

export async function POST(request: NextRequest) {
  try {
    // In a real implementation, you'd get the customer ID from the user's session/database
    // For demo purposes, we'll create a portal session with a placeholder
    
    // You would typically:
    // 1. Get the user's Stripe customer ID from your database
    // 2. Create a portal session for that customer
    
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: 'cus_placeholder', // Replace with actual customer ID
      return_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/premium`,
    });

    return NextResponse.json({
      url: portalSession.url,
    });
  } catch (error) {
    console.error('Customer portal error:', error);
    return NextResponse.json(
      { error: 'Failed to create customer portal session' },
      { status: 500 }
    );
  }
}