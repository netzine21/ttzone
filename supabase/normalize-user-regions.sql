-- 회원 활동지역 정규화 마이그레이션
-- 기존 region 원문은 보존하고 region_sido / region_sigungu를 채웁니다.

begin;

alter table public.users
  add column if not exists region_sido text,
  add column if not exists region_sigungu text;

with source as (
  select
    id,
    trim(regexp_replace(coalesce(region, ''), '\s+', ' ', 'g')) as raw_region
  from public.users
), parsed as (
  select
    id,
    raw_region,
    case
      when raw_region ~* '^(서울특별시|서울시|서울)(\s|$)' then '서울특별시'
      when raw_region ~* '^(부산광역시|부산시|부산)(\s|$)' then '부산광역시'
      when raw_region ~* '^(대구광역시|대구시|대구)(\s|$)' then '대구광역시'
      when raw_region ~* '^(인천광역시|인천시|인천)(\s|$)' then '인천광역시'
      when raw_region ~* '^(광주광역시|광주시|광주)(\s|$)' then '광주광역시'
      when raw_region ~* '^(대전광역시|대전시|대전)(\s|$)' then '대전광역시'
      when raw_region ~* '^(울산광역시|울산시|울산)(\s|$)' then '울산광역시'
      when raw_region ~* '^(세종특별자치시|세종시|세종)(\s|$)' then '세종특별자치시'
      when raw_region ~* '^(경기도|경기)(\s|$)' then '경기도'
      when raw_region ~* '^(강원특별자치도|강원도|강원)(\s|$)' then '강원특별자치도'
      when raw_region ~* '^(충청북도|충북)(\s|$)' then '충청북도'
      when raw_region ~* '^(충청남도|충남)(\s|$)' then '충청남도'
      when raw_region ~* '^(전북특별자치도|전라북도|전북)(\s|$)' then '전북특별자치도'
      when raw_region ~* '^(전라남도|전남)(\s|$)' then '전라남도'
      when raw_region ~* '^(경상북도|경북)(\s|$)' then '경상북도'
      when raw_region ~* '^(경상남도|경남)(\s|$)' then '경상남도'
      when raw_region ~* '^(제주특별자치도|제주도|제주)(\s|$)' then '제주특별자치도'
      else null
    end as sido
  from source
)
update public.users as u
set
  region_sido = coalesce(u.region_sido, p.sido),
  region_sigungu = coalesce(
    u.region_sigungu,
    case
      when p.sido is null or p.sido = '세종특별자치시' then null
      else nullif(
        split_part(
          trim(regexp_replace(p.raw_region, '^[^ ]+\s*', '')),
          ' ',
          1
        ),
        ''
      )
    end
  )
from parsed as p
where u.id = p.id
  and (u.region_sido is null or u.region_sigungu is null);

-- 정규화에 성공한 회원은 region도 동일한 표시값으로 맞춥니다.
update public.users
set region = concat_ws(' ', region_sido, region_sigungu)
where nullif(region_sido, '') is not null;

commit;

-- 확인용 조회
select id, nickname, member_id, region, region_sido, region_sigungu
from public.users
order by created_at desc;

-- 아래 조회 결과의 region_sido가 null인 회원은 원문을 확인한 뒤 수동 보정합니다.
-- update public.users
-- set region_sido = '인천광역시', region_sigungu = '미추홀구', region = '인천광역시 미추홀구'
-- where member_id = '회원ID';
