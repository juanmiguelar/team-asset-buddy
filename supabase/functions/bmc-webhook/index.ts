import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Buy Me a Coffee webhook handler
// Processes membership events to activate/deactivate subscriptions

interface BMCWebhookPayload {
  type: string;
  data: {
    supporter_email?: string;
    payer_email?: string;
    membership_level_id?: number;
    membership_level_name?: string;
    is_active?: boolean;
    current_price?: number;
    subscription_id?: string;
  };
}

// Map BMC membership level names to plan types
function mapMembershipToPlan(levelName: string | undefined, price: number | undefined): 'free' | 'pro' | 'enterprise' {
  // Map based on price or level name
  if (price && price >= 99) return 'enterprise';
  if (price && price >= 29) return 'pro';
  
  const name = levelName?.toLowerCase() || '';
  if (name.includes('enterprise')) return 'enterprise';
  if (name.includes('pro')) return 'pro';
  
  return 'free';
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify webhook secret (BMC sends it in header)
    const webhookSecret = Deno.env.get("BMC_WEBHOOK_SECRET");
    
    // BMC doesn't have a standard signature header, but you can add custom verification
    // For now, we'll proceed with processing but log a warning if no secret is set
    if (!webhookSecret) {
      console.warn("BMC_WEBHOOK_SECRET not configured - webhook verification disabled");
    }

    const payload: BMCWebhookPayload = await req.json();
    console.log("Received BMC webhook:", JSON.stringify(payload, null, 2));

    const { type, data } = payload;
    const supporterEmail = data.supporter_email || data.payer_email;

    if (!supporterEmail) {
      console.error("No supporter email in webhook payload");
      return new Response(
        JSON.stringify({ error: "No supporter email provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find organization by supporter email
    // First, find a profile with this email
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", supporterEmail.toLowerCase())
      .single();

    if (profileError || !profile) {
      console.log(`No user found with email: ${supporterEmail}`);
      // Store the webhook data for manual matching later
      return new Response(
        JSON.stringify({ 
          message: "Webhook received but no matching user found",
          email: supporterEmail 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find the user's organization (as owner)
    const { data: membership, error: membershipError } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", profile.id)
      .eq("role", "owner")
      .single();

    if (membershipError || !membership) {
      console.log(`User ${supporterEmail} is not an owner of any organization`);
      return new Response(
        JSON.stringify({ 
          message: "User found but is not an organization owner",
          email: supporterEmail 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const organizationId = membership.organization_id;
    const plan = mapMembershipToPlan(data.membership_level_name, data.current_price);
    const now = new Date().toISOString();

    // Handle different webhook types
    switch (type) {
      case "membership.started":
      case "membership.renewed":
      case "membership.upgraded": {
        // Activate or upgrade subscription
        const { error: updateError } = await supabase
          .from("organization_subscriptions")
          .update({
            plan: plan,
            status: "active",
            bmc_supporter_email: supporterEmail,
            bmc_subscription_id: data.subscription_id || null,
            current_period_start: now,
            // BMC memberships are typically monthly, set end to 35 days for buffer
            current_period_end: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000).toISOString(),
            updated_at: now,
          })
          .eq("organization_id", organizationId);

        if (updateError) {
          console.error("Error updating subscription:", updateError);
          return new Response(
            JSON.stringify({ error: "Failed to update subscription" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        console.log(`Subscription activated for org ${organizationId}: ${plan}`);
        break;
      }

      case "membership.cancelled":
      case "membership.expired": {
        // Mark subscription as canceled
        const { error: cancelError } = await supabase
          .from("organization_subscriptions")
          .update({
            status: "canceled",
            updated_at: now,
          })
          .eq("organization_id", organizationId);

        if (cancelError) {
          console.error("Error canceling subscription:", cancelError);
          return new Response(
            JSON.stringify({ error: "Failed to cancel subscription" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        console.log(`Subscription canceled for org ${organizationId}`);
        break;
      }

      case "membership.payment_failed": {
        // Mark as past due
        const { error: failError } = await supabase
          .from("organization_subscriptions")
          .update({
            status: "past_due",
            updated_at: now,
          })
          .eq("organization_id", organizationId);

        if (failError) {
          console.error("Error updating subscription to past_due:", failError);
        }

        console.log(`Subscription marked as past_due for org ${organizationId}`);
        break;
      }

      default:
        console.log(`Unhandled webhook type: ${type}`);
    }

    return new Response(
      JSON.stringify({ success: true, type, organization_id: organizationId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Webhook processing error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
