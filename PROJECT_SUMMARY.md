{
  "mobile_app": {
    "name": "Lead Intel Scan",
    "type": "Expo Router Mobile App",
    "overview": "Conference lead capture and prioritization app connected to Supabase. Focused on scanning, scoring, and follow-up management. No enrichment logic lives here.",
    "architecture": {
      "navigation": {
        "tabs": ["Capture", "Leads", "Priority", "Settings"],
        "leads_stack": ["LeadsList", "LeadDetail"]
      },
      "backend": "Supabase (shared with Admin)",
      "state_model": "Local UI state synced to backend",
      "enrichment": false
    },
    "features": {
      "capture": {
        "qr_scanning": true,
        "audio_recording": true,
        "flash_toggle": true,
        "permissions_handling": true
      },
      "leads": {
        "search": true,
        "stats": ["Total Leads"],
        "lead_card_fields": [
          "name",
          "company",
          "role",
          "status",
          "star_rating",
          "priority_score",
          "follow_up_date"
        ]
      },
      "lead_detail": {
        "editable_star_rating": true,
        "editable_priority_score": true,
        "shared_follow_up_date_picker": true,
        "notes_ui": true,
        "ai_insights_mocked": true,
        "hot_lead_removed": true
      },
      "priority_screen": {
        "ranking_by_priority_score": true
      },
      "settings": {
        "account_card": true,
        "event_summary": true
      }
    },
    "database_state": {
      "uses_table": "leads",
      "columns_used": [
        "rating",
        "priority_score",
        "follow_up_date",
        "company"
      ],
      "removed_columns": ["is_hot", "quick_tags"]
    },
    "current_status": {
      "rating_sync_fixed": true,
      "card_detail_state_sync_fixed": true,
      "follow_up_date_persists": true,
      "stable": true
    }
  },

  "admin_app": {
    "name": "Lead Retrieval Admin",
    "type": "Next.js App Router Web App",
    "overview": "Web dashboard for exhibitors and organizers. Manages leads, analytics, scoring, and upcoming enrichment layer.",
    "architecture": {
      "framework": "Next.js App Router",
      "backend": "Supabase with RLS",
      "shared_table_with_mobile": "leads",
      "roles": ["Event Organizer", "Exhibitor Admin"]
    },
    "features": {
      "dashboard": {
        "metrics": [
          "Total Companies",
          "Total Leads",
          "Total Hot Leads (legacy metric)",
          "Follow-ups Due"
        ],
        "charts": [
          "Leads Over Time",
          "AI Priority Distribution"
        ],
        "clickable_cards": true
      },
      "leads_table": {
        "sortable_columns": true,
        "filters": true,
        "row_click_to_detail": true,
        "inline_star_editing": true,
        "status_badge": true,
        "follow_up_date": true,
        "company_display": true
      },
      "lead_detail": {
        "editable_star_rating": true,
        "editable_priority_score": true,
        "follow_up_date_editing": true,
        "company_display": true,
        "hot_logic_removed": true
      }
    },
    "database_state": {
      "leads_columns": [
        "rating",
        "priority_score",
        "follow_up_date"
      ],
      "removed_columns": ["is_hot", "quick_tags"],
      "planned_enrichment": {
        "new_table": "lead_enrichments",
        "normalized_columns_on_leads": [
          "enriched_job_title",
          "enriched_seniority",
          "enriched_company_size",
          "enriched_industry",
          "enriched_linkedin_url",
          "enriched_score"
        ]
      }
    },
    "branch_state": {
      "main_clean": true,
      "previous_branch_merged": "feat/admin-leads-table-v2",
      "next_branch": "feat/admin-lead-enrichment"
    },
    "next_focus": "Build provider-agnostic enrichment layer (Apollo first, swappable later)"
  }
}