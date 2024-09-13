CREATE OR REPLACE FUNCTION public.new_tournament(
	n_id bigint,
	v_name character varying,
	v_abbr character varying,
	v_description character varying,
	v_link character varying,
	n_submitted_by bigint,
	r_users main_osuuser[],
	r_roles integer[],
	r_mappools database_mappoolconnection[])
    RETURNS bigint
    LANGUAGE 'plpgsql'
    COST 100
    VOLATILE PARALLEL UNSAFE
AS $BODY$
DECLARE
	n_user_i int := 1;
	n_mappool_id int := 1;
	n_tournament_id int := n_id;
	
BEGIN

IF n_tournament_id = 0 THEN
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
		n_submitted_by
	) RETURNING id INTO n_tournament_id;
ELSE
	UPDATE database_tournament SET
		abbreviation = v_abbr,
		name = v_name,
		description = v_description,
		link = v_link
	WHERE id = n_tournament_id;
	DELETE FROM database_tournamentinvolvement WHERE tournament_id = n_tournament_id;
	DELETE FROM database_mappoolconnection WHERE tournament_id = n_tournament_id;
END IF;

WHILE n_mappool_id <= array_length(r_mappools, 1) LOOP
	INSERT INTO database_mappoolconnection (
		tournament_id,
		mappool_id,
		name_override
	) VALUES (
		n_tournament_id,
		r_mappools[n_mappool_id].mappool_id,
		r_mappools[n_mappool_id].name_override
	);
	
	n_mappool_id := n_mappool_id + 1;
END LOOP;

WHILE n_user_i <= array_length(r_users, 1) LOOP
	INSERT INTO main_osuuser (
		id,
		username,
		avatar,
		cover,
		is_admin
	) VALUES (
		r_users[n_user_i].id,
		r_users[n_user_i].username,
		r_users[n_user_i].avatar,
		r_users[n_user_i].cover,
		r_users[n_user_i].is_admin
	) ON CONFLICT (id) DO UPDATE SET
		username = r_users[n_user_i].username,
		avatar = r_users[n_user_i].avatar,
		cover = r_users[n_user_i].cover;

	INSERT INTO database_tournamentinvolvement (
		roles,
		tournament_id,
		user_id
	) VALUES (
		r_roles[n_user_i],
		n_tournament_id,
		r_users[n_user_i].id
	);

	n_user_i := n_user_i + 1;
END LOOP;

RETURN n_tournament_id;

END;
$BODY$;