alter table public.session_feedback enable row level security;

create or replace function public.get_feedback_summary(p_user_ids uuid[])
returns table(
  user_id uuid,
  total_feedback integer,
  thumbs_up_count integer,
  thumbs_down_count integer,
  positive_ratio numeric,
  top_tags text[]
)
language sql
security definer
set search_path = public
as $$
  with target as (
    select unnest(coalesce(p_user_ids, '{}'::uuid[]))::uuid as user_id
  ),
  agg as (
    select
      t.user_id,
      count(sf.*)::integer as total_feedback,
      count(*) filter (where sf.thumbs_up)::integer as thumbs_up_count,
      count(*) filter (where not sf.thumbs_up)::integer as thumbs_down_count
    from target t
    left join public.session_feedback sf on sf.reviewee_user_id = t.user_id
    group by t.user_id
  ),
  tag_counts as (
    select
      t.user_id,
      sf.tag,
      count(*)::integer as tag_count
    from target t
    left join public.session_feedback sf
      on sf.reviewee_user_id = t.user_id
      and sf.tag is not null
      and length(trim(sf.tag)) > 0
    group by t.user_id, sf.tag
  ),
  top_tags as (
    select
      tc.user_id,
      coalesce(array_agg(tc.tag order by tc.tag_count desc, tc.tag asc) filter (where tc.tag is not null), '{}'::text[]) as top_tags
    from (
      select
        user_id,
        tag,
        tag_count,
        row_number() over (partition by user_id order by tag_count desc, tag asc) as rn
      from tag_counts
      where tag is not null
    ) tc
    where tc.rn <= 3
    group by tc.user_id
  )
  select
    a.user_id,
    a.total_feedback,
    a.thumbs_up_count,
    a.thumbs_down_count,
    case
      when a.total_feedback = 0 then 0
      else round((a.thumbs_up_count::numeric / a.total_feedback::numeric) * 100, 1)
    end as positive_ratio,
    coalesce(tt.top_tags, '{}'::text[]) as top_tags
  from agg a
  left join top_tags tt on tt.user_id = a.user_id;
$$;
