// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, table, data, id, query, filters, orderBy, eqFilters } = await req.json()

    // Analytics shortcut — fetches all needed data with service role (bypasses RLS)
    if (action === 'ANALYTICS') {
      const lastWeek = new Date()
      lastWeek.setDate(lastWeek.getDate() - 7)
      const lastWeekStr = lastWeek.toISOString().split('T')[0]

      const supabaseAdmin2 = createClient(
        Deno.env.get('SUPABASE_URL'),
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
      )

      const [bookingsRes, salonsRes, requestsRes, completedRes] = await Promise.all([
        supabaseAdmin2.from('bookings').select('booking_date, id').gte('booking_date', lastWeekStr),
        supabaseAdmin2.from('salons').select('id, is_suspended'),
        supabaseAdmin2.from('salon_requests').select('id').eq('status', 'pending'),
        supabaseAdmin2.from('bookings').select('total_price, salons(name)').eq('status', 'completed'),
      ])

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            weeklyBookings: bookingsRes.data || [],
            salons: salonsRes.data || [],
            pendingRequests: requestsRes.data || [],
            completedBookings: completedRes.data || [],
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Initialize Supabase Admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    )

    let result: any = { data: null, error: null }

    switch (action) {
      case 'SELECT':
        // Some tables use different timestamp column names
        const defaultOrder = table === 'customers' ? 'joined_at' : 'created_at'
        let selectQuery = supabaseAdmin.from(table).select(query || '*')
        if (id) {
          selectQuery = selectQuery.eq('id', id)
        }
        // Support eqFilters: [{ column, value }] for filtering
        if (eqFilters && Array.isArray(eqFilters)) {
          eqFilters.forEach((f: any) => {
            selectQuery = selectQuery.eq(f.column, f.value)
          })
        }
        // Legacy filters support
        if (filters && Array.isArray(filters) && !eqFilters) {
          filters.forEach((f: any) => {
            selectQuery = selectQuery.eq(f.column, f.value)
          })
        }
        // Support custom orderBy: { column, ascending }
        const finalOrder = orderBy?.column || defaultOrder
        const ascending = orderBy?.ascending !== undefined ? orderBy.ascending : false
        result = await selectQuery.order(finalOrder, { ascending })
        break

      case 'UPDATE':
        result = await supabaseAdmin
          .from(table)
          .update(data)
          .eq('id', id)
          .select()
        break

      case 'INSERT':
        result = await supabaseAdmin
          .from(table)
          .insert(data)
          .select()
        break

      case 'DELETE':
        result = await supabaseAdmin
          .from(table)
          .delete()
          .eq('id', id)
        break

      default:
        return new Response(
          JSON.stringify({ error: 'Unsupported action' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }

    if (result.error) {
      console.error(`DB Error (${action} ${table}):`, result.error)
      return new Response(
        JSON.stringify({ success: false, error: result.error }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    return new Response(
      JSON.stringify({ success: true, data: result.data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (err: unknown) {
    console.error('Proxy Error:', err)
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

