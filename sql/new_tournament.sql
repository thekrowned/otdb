CREATE OR REPLACE FUNCTION public.new_tournament(
	v_id bigint,
	v_name character varying,
	v_abbr character varying,
	v_description character varying,
	v_link character varying,
	v_submitted_by bigint,
	v_users main_osuuser[],
	v_roles integer[],
	v_mappools database_mappoolconnection[])
    RETURNS bigint
    LANGUAGE 'plpgsql'
    COST 100
    VOLATILE PARALLEL UNSAFE
AS $BODY$
DECLARE
	v_user_i int := 1;
	v_mappool_i int := 1;
	v_tournament_id int := v_id;
	
BEGIN

IF v_tournament_id = 0 THEN
	INSERT INTO database_tournament (
		abbreviation,
		name,
		description,
		link,
		submitted_by_id
	) VALUES (
		v_abbr,
		v_name,
		v_description,
		v_link,
		v_submitted_by
	) RETURNING id INTO v_tournament_id;
ELSE
	UPDATE database_tournament SET
		abbreviation = v_abbr,
		name = v_name,
		description = v_description,
		link = v_link
	WHERE id = v_tournament_id;
	DELETE FROM database_tournamentinvolvement WHERE tournament_id = v_tournament_id;
	DELETE FROM database_mappoolconnection WHERE tournament_id = v_tournament_id;
END IF;

WHILE v_mappool_i <= array_length(v_mappools, 1) LOOP
	INSERT INTO database_mappoolconnection (
		tournament_id,
		mappool_id,
		name_override
	) VALUES (
		v_tournament_id,
		v_mappools[v_mappool_i].mappool_id,
		v_mappools[v_mappool_i].name_override
	);
	
	v_mappool_i := v_mappool_i + 1;
END LOOP;

WHILE v_user_i <= array_length(v_users, 1) LOOP
	INSERT INTO main_osuuser (
		id,
		username,
		avatar,
		cover,
		is_admin
	) VALUES (
		v_users[v_user_i].id,
		v_users[v_user_i].username,
		v_users[v_user_i].avatar,
		v_users[v_user_i].cover,
		v_users[v_user_i].is_admin
	) ON CONFLICT (id) DO UPDATE SET
		username = v_users[v_user_i].username,
		avatar = v_users[v_user_i].avatar,
		cover = v_users[v_user_i].cover;

	INSERT INTO database_tournamentinvolvement (
		roles,
		tournament_id,
		user_id
	) VALUES (
		v_roles[v_user_i],
		v_tournament_id,
		v_users[v_user_i].id
	);

	v_user_i := v_user_i + 1;
END LOOP;

RETURN v_tournament_id;

END;
$BODY$;